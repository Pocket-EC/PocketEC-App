import { NgModule } from '@angular/core';

import { TextMaskModule } from 'angular2-text-mask';

@NgModule({
  imports: [
    TextMaskModule
  ],
  exports: [
		TextMaskModule
  ]

})
export class ValidatorsModule {}
