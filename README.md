# PocketEC-App
This is an IONIC 3 project created with IONIC CLI

* https://ionicframework.com/docs/cli/ 

An android app is available to download in Google Play

## Demo 

Please look here for demo videos and further instructions


To develop your own features, please fork this repository. 

## Prerequesites 

## NVM
* Please install the latest version from here - https://github.com/nvm-sh/nvm
* Download the clone and run 
```
 nvm use
 npm install
```


This app can only be tested on a device as it uses Ionic native plugins. 

To test the app on an Android phone, connect the phone to your computer and run: 
```
ionic cordova run android -lsc --device --prod --no-interactive
```

To connect a new Potentiostat to the app, go to settings and scan for a new device.

Make sure to enter the required values for configuring the app to communicate with your Potentiostat in the Settings page before configuring and recording experiments on your Potentiostat. 



