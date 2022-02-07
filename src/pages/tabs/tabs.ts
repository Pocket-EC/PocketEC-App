import { Component,ViewChild } from '@angular/core';
import { NavParams } from 'ionic-angular';
import { SettingsPage } from '../settings/settings';
import { ChartsPage } from '../charts/charts';
import { HomePage } from '../home/home';
import { AnalysisPage } from '../analysis/analysis';

@Component({
  templateUrl: 'tabs.html'
})
export class TabsPage {

  tab1Root = HomePage;
  tab2Root = SettingsPage;
  tab3Root = ChartsPage;
  tab4Root = AnalysisPage;
  index;
  @ViewChild('myTabs') tabRef: TabsPage;

  constructor(public navParams: NavParams) {

  }
  ionViewWillEnter(){
    this.index = this.navParams.get('index');
  }

}
