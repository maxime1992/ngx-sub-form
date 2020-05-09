import {
  AbstractControlOptions,
  ControlValueAccessor,
  FormArray,
  FormControl,
  FormGroup,
  Validator,
} from '@angular/forms';
import { Observable, ReplaySubject } from 'rxjs';
import { ArrayPropertyKey, ControlsNames, FormErrors, OneOfControlsTypes, TypedFormGroup } from '../ngx-sub-form-utils';
import { NgxSubFormRemapOptions, NgxSubFormWithArrayOptions } from './ngx-sub-form';

export const deepCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export type Nilable<T> = T | null | undefined;

export interface NgxSubForm<FormInterface> {
  readonly formGroup: TypedFormGroup<FormInterface>;
  readonly formControlNames: ControlsNames<FormInterface>;
  readonly formGroupErrors: FormErrors<FormInterface>;
}

export type ControlValueAccessorComponentInstance = Object &
  // ControlValueAccessor methods are called
  // directly by Angular and expects a value
  // so we have to define it within ngx-sub-form
  // and this should *never* be overridden by the component
  Partial<Record<keyof ControlValueAccessor, never> & Record<keyof Validator, never>>;

export const patchClassInstance = (componentInstance: any, obj: Object) => {
  Object.entries(obj).forEach(([key, newMethod]) => {
    componentInstance[key] = newMethod;
  });
};

export interface FormBindings<ControlInterface> {
  readonly writeValue$: Observable<Nilable<ControlInterface>>;
  readonly registerOnChange$: Observable<(formValue: ControlInterface) => void>;
  readonly registerOnTouched$: Observable<(_: any) => void>;
  readonly setDisabledState$: Observable<boolean>;
}

export const getControlValueAccessorBindings = <ControlInterface>(
  componentInstance: ControlValueAccessorComponentInstance,
): FormBindings<ControlInterface> => {
  const writeValue$$: ReplaySubject<Nilable<ControlInterface>> = new ReplaySubject(1);
  const registerOnChange$$: ReplaySubject<(formValue: ControlInterface) => void> = new ReplaySubject(1);
  const registerOnTouched$$: ReplaySubject<(_: any) => void> = new ReplaySubject(1);
  const setDisabledState$$: ReplaySubject<boolean> = new ReplaySubject(1);

  const controlValueAccessorPatch: Required<ControlValueAccessor> = {
    writeValue: (obj: Nilable<any>): void => {
      writeValue$$.next(obj);
    },
    registerOnChange: (fn: (formValue: ControlInterface) => void): void => {
      registerOnChange$$.next(fn);
    },
    registerOnTouched: (fn: () => void): void => {
      registerOnTouched$$.next(fn);
    },
    setDisabledState: (shouldDisable: boolean | undefined): void => {
      setDisabledState$$.next(shouldDisable);
    },
  };

  patchClassInstance(componentInstance, controlValueAccessorPatch);

  return {
    writeValue$: writeValue$$.asObservable(),
    registerOnChange$: registerOnChange$$.asObservable(),
    registerOnTouched$: registerOnTouched$$.asObservable(),
    setDisabledState$: setDisabledState$$.asObservable(),
  };
};
// const safelyPatchClassInstance = (componentInstance: any, obj: Object) => {
//   Object.entries(obj).forEach(([key, newMethod]) => {
//     const previousMethod = componentInstance[key];

//     componentInstance[key] = (...args: any[]) => {
//       if (previousMethod) {
//         previousMethod.apply(componentInstance);
//       }

//       newMethod(args);
//     };
//   });
// };

export const getFormGroupErrors = <ControlInterface, FormInterface>(
  formGroup: TypedFormGroup<FormInterface>,
): FormErrors<FormInterface> => {
  let errorsCount: number = 0;
  const formErrors: FormErrors<ControlInterface> = Object.entries<OneOfControlsTypes>(formGroup.controls).reduce<
    Exclude<FormErrors<ControlInterface>, null>
  >((acc, [key, value]) => {
    if (value.errors) {
      // @todo remove any
      acc[key as keyof ControlInterface] = value.errors as any;
      errorsCount++;
    }
    return acc;
  }, {});

  if (!formGroup.errors && !errorsCount) {
    return null;
  }

  // todo remove any
  return Object.assign<any, any, any>({}, formGroup.errors ? { formGroup: formGroup.errors } : {}, formErrors);
};

export interface FormArrayWrapper<FormInterface> {
  key: keyof FormInterface;
  control: FormArray;
}

export function createFormDataFromOptions<ControlInterface, FormInterface>(
  options: NgxSubFormRemapOptions<ControlInterface, FormInterface>,
) {
  const formGroup: TypedFormGroup<FormInterface> = new FormGroup(
    options.formControls,
    options.formGroupOptions as AbstractControlOptions,
  ) as TypedFormGroup<FormInterface>;
  const defaultValues: FormInterface = deepCopy(formGroup.value);
  const formGroupKeys: (keyof FormInterface)[] = Object.keys(defaultValues) as (keyof FormInterface)[];
  const formControlNames: ControlsNames<FormInterface> = formGroupKeys.reduce<ControlsNames<FormInterface>>(
    (acc, curr) => {
      acc[curr] = curr;
      return acc;
    },
    {} as ControlsNames<FormInterface>,
  );

  const formArrays: FormArrayWrapper<FormInterface>[] = formGroupKeys.reduce<FormArrayWrapper<FormInterface>[]>(
    (acc, key) => {
      const control = formGroup.get(key as string);
      if (control instanceof FormArray) {
        acc.push({ key, control });
      }
      return acc;
    },
    [],
  );
  return { formGroup, defaultValues, formControlNames, formArrays };
}

export const handleFArray = <FormInterface>(
  formArrayWrappers: FormArrayWrapper<FormInterface>[],
  obj: FormInterface,
  createFormArrayControl: NgxSubFormWithArrayOptions<FormInterface>['createFormArrayControl'] | null,
) => {
  if (!formArrayWrappers.length) {
    return;
  }

  formArrayWrappers.forEach(({ key, control }) => {
    const value = obj[key];

    if (!Array.isArray(value)) {
      return;
    }

    // instead of creating a new array every time and push a new FormControl
    // we just remove or add what is necessary so that:
    // - it is as efficient as possible and do not create unnecessary FormControl every time
    // - validators are not destroyed/created again and eventually fire again for no reason
    while (control.length > value.length) {
      control.removeAt(control.length - 1);
    }

    for (let i = control.length; i < value.length; i++) {
      if (createFormArrayControl) {
        control.insert(i, createFormArrayControl(key as ArrayPropertyKey<FormInterface>, value[i]));
      } else {
        control.insert(i, new FormControl(value[i]));
      }
    }
  });
};
