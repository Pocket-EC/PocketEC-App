
import { Injectable } from '@angular/core';
import { EmailComposer } from '@ionic-native/email-composer';

/*
  Generated class for the EmailProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class EmailProvider {

  constructor(
  private emailComposer: EmailComposer) {

  }

  /**
  * Send an email with attached data - (opens up the phone's sharing interface, so user Could
  * choose other apps like Drive, Bluetooth, Whatsapp etc. to share data.
  * @param emailAddress email address to send email to
  * @param filenameWithPath name and path of file to be attached in the email
  * @param subject line for email as string
  * @param body text for body of email as string.
  */

  sendEmail(emailAddress,filenameWithPath,subject,body){
    this.logError('Sending email','');
    let email = {
      to: emailAddress,
      attachments: filenameWithPath,
      subject: subject,
      body: body
    };
    this.emailComposer.addAlias('gmail', 'com.google.android.gm');
    return this.emailComposer.hasPermission()
    .then((permission)=>{
      if(permission){
        this.emailComposer.open(email).then(()=>{
          this.logError('Email composer has opened. ','');
        },(error)=>{
          this.logError('Email composer could not be opened. ', error);
          throw error;
        });
      }
      else{
        return this.emailComposer.requestPermission()
      }
    })
    .catch((er)=>{
      this.logError('Error checking for email permission ',er);
      throw er;
    })
    .then((permission1)=>{
      if(permission1){
        this.emailComposer.open(email).then(()=>{
          this.logError('Email composer has opened. ','');
        },(error)=>{
          this.logError('Email composer could not be opened. ',error);
          throw error;
        });
      }
      else{
        this.logError('No permission','');
        throw new Error('No permission detected for email');
      }
    })
    .catch((reqperError)=>{
      this.logError('Error requesting permission',reqperError);
      throw reqperError;
    });
  }


  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('EmailProvider: ' + message + ' ' + errStackTrace);

  }

}
