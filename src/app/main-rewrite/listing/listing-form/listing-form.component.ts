import { Component, Input, Output } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { ListingType, OneListing } from 'src/app/interfaces/listing.interface';
import { createForm } from '../../../../../projects/ngx-sub-form/src/lib/new/ngx-sub-form';
import { FormType } from '../../../../../projects/ngx-sub-form/src/lib/new/ngx-sub-form.types';
import { OneDroid } from '../../../interfaces/droid.interface';
import { OneVehicle } from '../../../interfaces/vehicle.interface';
import { UnreachableCase } from '../../../shared/utils';

interface OneListingForm {
  vehicleProduct: OneVehicle | null;
  droidProduct: OneDroid | null;
  listingType: ListingType | null;
  id: string;
  title: string;
  imageUrl: string;
  price: number;
}

@Component({
  selector: 'app-listing-form',
  templateUrl: './listing-form.component.html',
  styleUrls: ['./listing-form.component.scss'],
})
export class ListingFormComponent {
  private input$: Subject<OneListing | undefined> = new Subject();
  @Input() set listing(value: OneListing | undefined) {
    this.input$.next(value);
  }

  private disabled$: Subject<boolean> = new Subject();
  @Input() set disabled(value: boolean | undefined) {
    this.disabled$.next(!value ? false : value);
  }

  @Output() listingUpdated: Subject<OneListing> = new Subject();

  private onDestroy$: Subject<void> = new Subject();

  public form = createForm<OneListing, OneListingForm>(this, {
    formType: FormType.ROOT,
    disabled$: this.disabled$,
    input$: this.input$,
    output$: this.listingUpdated,
    formControls: {
      vehicleProduct: new FormControl(null),
      droidProduct: new FormControl(null),
      listingType: new FormControl(null, Validators.required),
      id: new FormControl(null, Validators.required),
      title: new FormControl(null, Validators.required),
      imageUrl: new FormControl(null, Validators.required),
      price: new FormControl(null, Validators.required),
    },
    toFormGroup: (obj: OneListing): OneListingForm => {
      const { listingType, product, ...commonValues } = obj;

      return {
        vehicleProduct: obj.listingType === ListingType.VEHICLE ? obj.product : null,
        droidProduct: obj.listingType === ListingType.DROID ? obj.product : null,
        listingType: obj.listingType,
        ...commonValues,
      };
    },
    fromFormGroup: (formValue: OneListingForm): OneListing => {
      const { vehicleProduct, droidProduct, listingType, ...commonValues } = formValue;

      switch (listingType) {
        case ListingType.DROID:
          return droidProduct ? { product: droidProduct, listingType, ...commonValues } : (null as any); //todo;
        case ListingType.VEHICLE:
          return vehicleProduct ? { product: vehicleProduct, listingType, ...commonValues } : (null as any); //todo;
        case null:
          return null as any; // todo;
        default:
          throw new UnreachableCase(listingType);
      }
    },
    componentHooks: {
      ngOnDestroy$: this.onDestroy$.asObservable(),
    },
  });

  public ListingType: typeof ListingType = ListingType;

  public ngOnDestroy(): void {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }
}
