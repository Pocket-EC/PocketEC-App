import { NgModule, ErrorHandler } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
import { IonicStorageModule } from '@ionic/storage';
import { HttpModule } from '@angular/http';
import { SQLite } from '@ionic-native/sqlite';
import { MyApp } from './app.component';
import { RestangularModule, Restangular } from 'ngx-restangular';
import { ValidatorsModule } from '../validators/validators.module';
import { TextMaskModule } from 'angular2-text-mask';
import { Network } from '@ionic-native/network';
import { WheelSelector } from '@ionic-native/wheel-selector';
import { File } from '@ionic-native/file';
import { BackgroundMode } from '@ionic-native/background-mode';
import { Badge } from '@ionic-native/badge';
import { EmailComposer } from '@ionic-native/email-composer';
import { AppCenterCrashes } from '@ionic-native/app-center-crashes';
import { ExtendedDeviceInformation } from '@ionic-native/extended-device-information/ngx';


// import { FileOpener } from '@ionic-native/file-opener';



import { SettingsPage } from '../pages/settings/settings';
import { ChartsPage } from '../pages/charts/charts';
import { AnalysisPage } from '../pages/analysis/analysis';
import { HomePage } from '../pages/home/home';
import { TabsPage } from '../pages/tabs/tabs';
import { BtDevicePage } from '../pages/bt-device/bt-device';
import { SignupPage } from '../pages/signup/signup';
import { MethodsPage } from '../pages/methods/methods';
import { HelpModalPage } from '../pages/help-modal/help-modal';
import { CalibratePage } from '../pages/calibrate/calibrate';
import { UploadJsonPage } from '../pages/upload-json/upload-json';

import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';

import { BluetoothSerial } from '@ionic-native/bluetooth-serial'; //we need to use bluetooth plugin
import { BtSerialProvider } from '../providers/bt-serial/bt-serial'; //using ionic g adds this automatically
import { DatabaseProvider } from '../providers/database/database';
import { SharedserviceProvider } from '../providers/sharedservice/sharedservice';
import { AuthserviceProvider } from '../providers/authservice/authservice';
import { API,APIFactory } from '../providers/restservice/restservice';
import { BtDevicePageModule } from '../pages/bt-device/bt-device.module';
import { HelpModalPageModule } from '../pages/help-modal/help-modal.module';
import { CalibratePageModule } from '../pages/calibrate/calibrate.module';
import { UploadJsonPageModule } from '../pages/upload-json/upload-json.module';
import { SignupPageModule } from '../pages/signup/signup.module';
import { MethodsPageModule } from '../pages/methods/methods.module';
import { EmailProvider } from '../providers/email/email';
import { DataReaderService } from '../providers/datareaderservice/datareaderservice';
import { StatusUpdateProvider } from '../providers/statusupdateservice/statusupdateservice';
import { JsonConfigObjectParser} from '../providers/jsonConfigParser/jsonConfigParser'
import { ActionsheetserviceProvider } from '../providers/actionsheetservice/actionsheetservice';
import { DataProcessingProvider } from '../providers/dataprocessingservice/dataprocessingservice';



// Function for setting the default restangular configuration
export function RestangularConfigFactory (RestangularProvider) {

}



@NgModule({
  declarations: [
    MyApp,
    SettingsPage,
    ChartsPage,
    AnalysisPage,
    HomePage,
    TabsPage
  ],
  imports: [
    BrowserModule,
    HttpModule,
    ValidatorsModule,
    TextMaskModule,
    BtDevicePageModule,
    HelpModalPageModule,
    CalibratePageModule,
    UploadJsonPageModule,
    SignupPageModule,
    MethodsPageModule,
    IonicStorageModule.forRoot(),
    IonicModule.forRoot(MyApp),
    RestangularModule.forRoot(RestangularConfigFactory)
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    SettingsPage,
    ChartsPage,
    AnalysisPage,
    HomePage,
    TabsPage,
    BtDevicePage,
    SignupPage,
    MethodsPage,
    HelpModalPage,
    CalibratePage,
    UploadJsonPage
  ],
  providers: [
    StatusBar,
    SplashScreen,
    StatusUpdateProvider,
    JsonConfigObjectParser,
    BluetoothSerial,
    Network,
    {provide: ErrorHandler, useClass: IonicErrorHandler},
    SharedserviceProvider,
    ActionsheetserviceProvider,
    AuthserviceProvider,
    {
      provide: API,
      useFactory: APIFactory,
      deps: [
          Restangular,SharedserviceProvider
      ],
    },
    WheelSelector,
    File,
    // FileOpener,
    BackgroundMode,
    EmailComposer,
    DataReaderService,
    AppCenterCrashes,
    ExtendedDeviceInformation,
    Badge,
    BtSerialProvider,
    SQLite,
    DatabaseProvider,
    EmailProvider,
    ActionsheetserviceProvider,
    DataProcessingProvider,

  ]
})
export class AppModule {}
