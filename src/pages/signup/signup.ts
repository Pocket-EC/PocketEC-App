import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { AuthserviceProvider } from '../../providers/authservice/authservice';
import { DatabaseProvider } from '../../providers/database/database';
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';
import { FormGroup, FormControl, FormBuilder, Validators } from '@angular/forms';
import { PasswordValidator } from '../../validators/password.validator';
import emailMask from 'text-mask-addons/dist/emailMask';
import { HelpModalPage } from '../help-modal/help-modal';



@IonicPage()
@Component({
  selector: 'page-signup',
  templateUrl: 'signup.html',
})

export class SignupPage {
  user = {
      email: null as string,
      password: null as string,
      name: null as string
  };


  registerForm: FormGroup;
  matchingPasswordsGroup: FormGroup;
  emailMask = emailMask;


  validation_messages = {
    'name': [
      { type: 'required', message: 'Name is required.' }
    ],
    'email': [
      { type: 'required', message: 'Email is required.' },
      { type: 'pattern', message: 'Enter a valid email.' }
    ],
    'password': [
      { type: 'required', message: 'Password is required.' },
      { type: 'minlength', message: 'Password must be at least 5 characters long.' },
      { type: 'pattern', message: 'Your password must contain at least one uppercase, one lowercase, and one number.' }
    ],
    'confirmPassword': [
      { type: 'required', message: 'Confirm password is required' }
    ],
    'matchingPasswords': [
      { type: 'areEqual', message: 'Password mismatch' }
    ],
    'terms': [
      { type: 'pattern', message: 'You must accept terms and conditions.' }
    ]
  };







  constructor(public navCtrl: NavController,
    public navParams: NavParams,
    private AuthService: AuthserviceProvider,
    private SharedService: SharedserviceProvider,
    private DatabaseService: DatabaseProvider,
    public formBuilder: FormBuilder)
     {


  }



  ionViewWillLoad() {

    this.matchingPasswordsGroup = new FormGroup({
      password: new FormControl('', Validators.compose([
        Validators.required,
        Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[a-zA-Z0-9]+$')
      ])),
      confirmPassword: new FormControl('', Validators.required)
    }, (formGroup: FormGroup) => {
      return PasswordValidator.areEqual(formGroup);
    });

   	this.registerForm = this.formBuilder.group({
      name: new FormControl('',Validators.compose([
        Validators.required
      ])),
      email: new FormControl('',Validators.compose([
        Validators.required,
        Validators.pattern('^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$')
      ])),
      matchingPasswords: this.matchingPasswordsGroup,
      terms: new FormControl(true,Validators.pattern('true'))
		});
  }







  async register(form){
    this.user.name = form.name;
    this.user.email = form.email;
    this.user.password = form.matchingPasswords.password;
    try{
      let object = await this.AuthService.save(this.user);

			//Check SharedService for feedback first in case there is an API error sent back
			if(this.SharedService.getShowFeedback()){
				this.SharedService.presentAlert("WARNING", "type_warning", this.SharedService.getFeedbackMessage());
				this.SharedService.setAuth(false);
			}
			else{
				this.user = object.originalElement;
        let id = await this.DatabaseService.saveUserToLocalDatabase(this.user);
        this.navCtrl.getPrevious().data.user = this.user;
        this.navCtrl.getPrevious().data.user.localDbId = id;
        this.navCtrl.getPrevious().data.userId = id;
        console.log('New user signup: Success');

				this.SharedService.setShowFeedback(true);
				this.SharedService.setFeedbackType("INFO");
				this.SharedService.setFeedbackMessage("User " + this.user.name + " registered successfully and signed in!");
				this.SharedService.setFeedbackTypeBootstrap("type_info");
				this.SharedService.setAuth(true);
				this.SharedService.setUser(this.user);

        this.navCtrl.pop();
			}
		}
    catch(error){
			if(this.SharedService.getShowFeedback()){
				this.SharedService.presentAlert("ERROR", "type_error", this.SharedService.getFeedbackMessage());
			}
			this.SharedService.setAuth(false); //reset local authentication here.
		}
  }
  help(){
    this.navCtrl.push(HelpModalPage, { pageTitle: 'Terms and Conditions', index: 'home', stepsArray: null,license: true});
  }


}
