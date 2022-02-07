import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { BtDevicePage } from './bt-device';

@NgModule({
  declarations: [
    BtDevicePage,
  ],
  imports: [
    IonicPageModule.forChild(BtDevicePage),
  ],
})
export class BtDevicePageModule {}
