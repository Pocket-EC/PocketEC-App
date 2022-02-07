import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { UploadJsonPage } from './upload-json';

@NgModule({
  declarations: [
    UploadJsonPage,
  ],
  imports: [
    IonicPageModule.forChild(UploadJsonPage),
  ],
})
export class UploadJsonPageModule {}
