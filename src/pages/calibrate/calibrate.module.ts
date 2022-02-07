import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { CalibratePage } from './calibrate';

@NgModule({
  declarations: [
    CalibratePage,
  ],
  imports: [
    IonicPageModule.forChild(CalibratePage),
  ],
})
export class CalibratePageModule {}
