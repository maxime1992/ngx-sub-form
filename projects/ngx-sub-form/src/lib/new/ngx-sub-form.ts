import { ɵmarkDirty as markDirty } from '@angular/core';
import { EMPTY, forkJoin, Observable, of } from 'rxjs';
import { delay, filter, map, mapTo, shareReplay, switchMap, takeUntil, tap } from 'rxjs/operators';
import { isNullOrUndefined } from '../ngx-sub-form-utils';
import {
  createFormDataFromOptions,
  getControlValueAccessorBindings,
  getFormGroupErrors,
  handleFArray as handleFormArrays,
  patchClassInstance,
} from './helpers';
import {
  ControlValueAccessorComponentInstance,
  FormBindings,
  FormType,
  NgxFormOptions,
  NgxRootForm,
  NgxRootFormOptions,
  NgxSubForm,
  NgxSubFormArrayOptions,
  NgxSubFormOptions,
  NgxSubFormRemapOptions,
} from './ngx-sub-form.types';

const optionsHaveInstructionsToCreateArrays = <ControlInterface, FormInterface>(
  options: NgxSubFormOptions<ControlInterface, FormInterface>,
): options is NgxSubFormOptions<ControlInterface, FormInterface> & NgxSubFormArrayOptions<FormInterface> => true;

// @todo find a better name
const isRemap = <ControlInterface, FormInterface>(
  options: any,
): options is NgxSubFormRemapOptions<ControlInterface, FormInterface> => {
  const opt = options as NgxSubFormRemapOptions<ControlInterface, FormInterface>;
  return !!opt.fromFormGroup && !!opt.toFormGroup;
};

// @todo find a better name
const isRoot = <ControlInterface, FormInterface>(
  options: any,
): options is NgxRootFormOptions<ControlInterface, FormInterface> => {
  const opt = options as NgxRootFormOptions<ControlInterface, FormInterface>;
  return opt.formType === FormType.ROOT;
};

export function createForm<ControlInterface, FormInterface = ControlInterface>(
  componentInstance: ControlValueAccessorComponentInstance,
  options: NgxRootFormOptions<ControlInterface, FormInterface>,
): NgxRootForm<FormInterface>;
export function createForm<ControlInterface, FormInterface = ControlInterface>(
  componentInstance: ControlValueAccessorComponentInstance,
  options: NgxSubFormOptions<ControlInterface, FormInterface>,
): NgxSubForm<FormInterface>;
export function createForm<ControlInterface, FormInterface>(
  componentInstance: ControlValueAccessorComponentInstance,
  options: NgxFormOptions<ControlInterface, FormInterface>,
): NgxSubForm<FormInterface> {
  const { formGroup, defaultValues, formControlNames, formArrays } = createFormDataFromOptions<
    ControlInterface,
    FormInterface
  >(options);

  // this doesn't work for now see issue on the function
  // as a hack I'm asking to get within options an observable for some hooks...
  // const { ngOnDestroy$ } = getComponentHooks(componentInstance);

  // define the `validate` method to improve errors
  // and support nested errors
  patchClassInstance(componentInstance, {
    validate: () => {
      if (formGroup.valid) {
        return null;
      }

      return getFormGroupErrors<ControlInterface, FormInterface>(formGroup);
    },
  });

  const componentHooks = getControlValueAccessorBindings<ControlInterface>(componentInstance);

  const writeValue$: FormBindings<ControlInterface>['writeValue$'] = isRoot<ControlInterface, FormInterface>(options)
    ? options.input$
    : componentHooks.writeValue$;

  const registerOnChange$: FormBindings<ControlInterface>['registerOnChange$'] = isRoot<
    ControlInterface,
    FormInterface
  >(options)
    ? of(data => {
        if (!data) {
          return;
        }
        options.output$.next(data);
      })
    : componentHooks.registerOnChange$;

  const setDisabledState$: FormBindings<ControlInterface>['setDisabledState$'] = isRoot<
    ControlInterface,
    FormInterface
  >(options)
    ? options.disabled$
    : componentHooks.setDisabledState$;

  const transformedValue$: Observable<FormInterface> = writeValue$.pipe(
    map(value => {
      if (isNullOrUndefined(value)) {
        return defaultValues;
      }

      if (isRemap<ControlInterface, FormInterface>(options)) {
        return options.toFormGroup(value);
      }

      // if it's not a remap component, the ControlInterface === the FormInterface
      return (value as any) as FormInterface;
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  const broadcastValueToParent$: Observable<ControlInterface> = transformedValue$.pipe(
    switchMap(() => formGroup.valueChanges.pipe(delay(0))),
    filter(() => !isRoot<ControlInterface, FormInterface>(options) || formGroup.valid),
    map(value =>
      isRemap<ControlInterface, FormInterface>(options)
        ? options.fromFormGroup(value)
        : // if it's not a remap component, the ControlInterface === the FormInterface
          ((value as any) as ControlInterface),
    ),
  );

  const emitNullOnDestroy$: Observable<null> =
    // emit null when destroyed by default
    isNullOrUndefined(options.emitNullOnDestroy) || options.emitNullOnDestroy
      ? // ngOnDestroy$.pipe(mapTo(null))
        options.componentHooks.ngOnDestroy$.pipe(mapTo(null))
      : EMPTY;

  const sideEffects = {
    broadcastValueToParent$: registerOnChange$.pipe(
      switchMap(onChange => broadcastValueToParent$.pipe(tap(value => onChange(value)))),
    ),
    applyUpstreamUpdateOnLocalForm$: transformedValue$.pipe(
      tap(value => {
        handleFormArrays<FormInterface>(
          formArrays,
          value,
          optionsHaveInstructionsToCreateArrays<ControlInterface, FormInterface>(options)
            ? options.createFormArrayControl
            : null,
        );

        formGroup.reset(value);

        // support `changeDetection: ChangeDetectionStrategy.OnPush`
        // on the component hosting a form
        markDirty(componentInstance);
      }),
    ),
    setDisabledState$: setDisabledState$.pipe(
      tap((shouldDisable: boolean) => {
        shouldDisable ? formGroup.disable() : formGroup.enable();
      }),
    ),
  };

  forkJoin(sideEffects)
    .pipe(takeUntil(options.componentHooks.ngOnDestroy$))
    .subscribe();

  // following cannot be part of `forkJoin(sideEffects)`
  // because it uses `takeUntilDestroyed` which destroys
  // the subscription when the component is being destroyed
  // and therefore prevents the emit of the null value if needed
  registerOnChange$
    .pipe(
      switchMap(onChange => emitNullOnDestroy$.pipe(tap(value => onChange(value)))),
      takeUntil(options.componentHooks.ngOnDestroy$.pipe(delay(0))),
      // takeUntil(ngOnDestroy$.pipe(delay(0))),
    )
    .subscribe();

  return {
    formGroup,
    formControlNames,
    get formGroupErrors() {
      return getFormGroupErrors<ControlInterface, FormInterface>(formGroup);
    },
  };
}
