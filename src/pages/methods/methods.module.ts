import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { MethodsPage } from './methods';

@NgModule({
  declarations: [
    MethodsPage,
  ],
  imports: [
    IonicPageModule.forChild(MethodsPage),
  ],
})
export class MethodsPageModule {}
