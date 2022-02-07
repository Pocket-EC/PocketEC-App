import { Injectable } from '@angular/core';
import { ActionSheetController } from "ionic-angular";

/*

*/
@Injectable()
export class ActionsheetserviceProvider {

  constructor(private actionSheetCtrl: ActionSheetController) {

  }
  present(buttons: Array<any>) {
    buttons.push({
      text: 'Cancel',
      role: 'cancel',
    });
    let actionSheet = this.actionSheetCtrl.create({buttons: buttons});
    actionSheet.present();
  }
}
