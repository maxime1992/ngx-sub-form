import { Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { subformComponentProviders } from 'ngx-sub-form';
import { Subject } from 'rxjs';
import {
  AssassinDroid,
  AstromechDroid,
  DroidType,
  MedicalDroid,
  OneDroid,
  ProtocolDroid,
} from 'src/app/interfaces/droid.interface';
import { createForm } from '../../../../../../projects/ngx-sub-form/src/lib/new/ngx-sub-form';
import { FormType } from '../../../../../../projects/ngx-sub-form/src/lib/new/ngx-sub-form.types';
import { UnreachableCase } from '../../../../shared/utils';

interface OneDroidForm {
  protocolDroid: ProtocolDroid | null;
  medicalDroid: MedicalDroid | null;
  astromechDroid: AstromechDroid | null;
  assassinDroid: AssassinDroid | null;
  droidType: DroidType | null;
}

@Component({
  selector: 'app-droid-product',
  templateUrl: './droid-product.component.html',
  styleUrls: ['./droid-product.component.scss'],
  providers: subformComponentProviders(DroidProductComponent),
})
export class DroidProductComponent {
  public DroidType = DroidType;

  private onDestroy$: Subject<void> = new Subject();

  public form = createForm<OneDroid, OneDroidForm>(this, {
    formType: FormType.SUB,
    formControls: {
      protocolDroid: new FormControl(null),
      medicalDroid: new FormControl(null),
      astromechDroid: new FormControl(null),
      assassinDroid: new FormControl(null),
      droidType: new FormControl(null, { validators: [Validators.required] }),
    },
    toFormGroup: (obj: OneDroid): OneDroidForm => {
      return {
        protocolDroid: obj.droidType === DroidType.PROTOCOL ? obj : null,
        medicalDroid: obj.droidType === DroidType.MEDICAL ? obj : null,
        astromechDroid: obj.droidType === DroidType.ASTROMECH ? obj : null,
        assassinDroid: obj.droidType === DroidType.ASSASSIN ? obj : null,
        droidType: obj.droidType,
      };
    },
    fromFormGroup: (formValue: OneDroidForm): OneDroid => {
      switch (formValue.droidType) {
        case DroidType.PROTOCOL:
          return formValue.protocolDroid as any; // todo
        case DroidType.MEDICAL:
          return formValue.medicalDroid as any; // todo
        case DroidType.ASTROMECH:
          return formValue.astromechDroid as any; // todo
        case DroidType.ASSASSIN:
          return formValue.assassinDroid as any; // todo
        case null:
          return null as any; // todo
        default:
          throw new UnreachableCase(formValue.droidType);
      }
    },
    componentHooks: {
      ngOnDestroy$: this.onDestroy$.asObservable(),
    },
  });

  public ngOnDestroy(): void {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }
}
