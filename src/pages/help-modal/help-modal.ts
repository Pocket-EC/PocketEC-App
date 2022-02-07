import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';

/**
 * Generated class for the HelpModalPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-help-modal',
  templateUrl: 'help-modal.html',
})
export class HelpModalPage {
  title: string = 'Help';
  stepsArray: Array<string> = [];
  index: string = 'home';
  license: boolean = false;



  constructor(public navCtrl: NavController, public navParams: NavParams) {
  }
  ionViewWillLoad(){
    this.title=this.navParams.get('pageTitle');
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad HelpModalPage');
    this.index=this.navParams.get('index');
    if(this.index === 'home'){
      this.license = this.navParams.get('license');
    }
    // this.stepsArray=this.navParams.get('stepsArray');
    // this.license=this.navParams.get('license');
  }

}
