import { Injectable,Inject } from '@angular/core';
import { Restangular } from 'ngx-restangular';
import { API } from '../restservice/restservice';

/**
@author: vm
Service class for handling REST requests for authenticating and creating accounts.
*/

@Injectable()
export class AuthserviceProvider {

  constructor(@Inject(API) private api: Restangular) {
  }

  /**
  * Returns error if email/password does not match to database.
  * @param user { email: string, password: string}
  *
  */
  loginUser (user){
    let baseUsers = this.api.all("login");
    let aPromise = baseUsers.post(user).toPromise();
    return aPromise;
  }

  save (user) {
		let baseUsers = this.api.all("users");
		let aPromise = baseUsers.post(user).toPromise();
		return aPromise;
	}

  updateServer(data){
    let baseUsers = this.api.all('btDevice');
    let aPromise = baseUsers.post(data).toPromise();
    return aPromise;
  }

}
