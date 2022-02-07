import { InjectionToken } from '@angular/core';
import { Restangular } from 'ngx-restangular';
import { SharedserviceProvider } from '../sharedservice/sharedservice';


export const API = new InjectionToken<Restangular>('API');

export function APIFactory(restangular: Restangular, SharedService: SharedserviceProvider): Restangular {
  return restangular.withConfig((RestangularConfigurer) => {

  	/**
  	* //TODO before sending to linux - For deployment on the Warwick linux box
  	*/

  	SharedService.setUrl('https://personalhealth.warwick.ac.uk/mobileHealth-api2.0.2/');

    //SharedService.setUrl('https://personalHealth.warwick.ac.uk/mobileHealth-api1.7.2');
    //SharedService.setUrl('http://desap.lnx.warwick.ac.uk:8080/mobileHealth-api-1.7.3/');
  	//SharedService.setUrl('http://192.168.1.37:8080/mobileHealth-api-1.7/');
  	//SharedService.setUrl('https://agper.lnx.warwick.ac.uk/mobileHealth-api1.9.3/');
    //SharedService.setUrl('https://localhost:8543/mobileHealth-api');

  	RestangularConfigurer.setBaseUrl(SharedService.getUrl());

    //Set token along with every request to server
  	RestangularConfigurer.addFullRequestInterceptor(function(headers){
      RestangularConfigurer.setDefaultHeaders({'X-Auth-Token':SharedService.getUniqueToken()});
  	});

  	/**
  	* setResponseExtractor handles all input from the API
  	*
  	*/
  	RestangularConfigurer.setResponseExtractor(function(response, operation, what, url,data) {
      SharedService.saveForLog((new Date().toISOString() + ': RestService: ').concat('Restangular response status: ').concat(response.status));
  		//Check if its a download operation
  		//not used 5-jan-15
  		if(SharedService.getDownload()){
  			SharedService.setDownload(null);
        SharedService.saveForLog((new Date().toISOString() + ': RestService: ').concat('is a download - therefore returning the response directly instead of payload').concat(''));
  			return response;
  		}

  		let req = what;
  		if(req =="plots/GetPlot"){
  			SharedService.saveForLog((new Date().toISOString() + ': RestService: ').concat('this is a getplot request, so return with data instead of response'));
  			if(data === "ERROR"){
  				SharedService.setShowFeedback(true);
  				SharedService.setFeedbackMessage(data); //object.data ?? 21.2.18 vm
  				SharedService.setFeedbackType("warning");
  			}
  			return data;
  		}
			if(response.apiStatus == 'EMAIL_EXISTS'){
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage(response.message);
				SharedService.setFeedbackType("warning");
				return;
			}
  		/**
  	  * clear the SharedService feedback, type & status here
  		*/
			SharedService.setShowFeedback(false);
			SharedService.setFeedbackMessage("");
			SharedService.setFeedbackType("");

  		let newResponse = response.payload;

			/**
			 * Handle response code 403. this is usually handled by Spring.
			 * When credentials are not enough to do a certain action
			 * examples: when accessing pages allowed only for admins (/users)
			 */


			if(response.status == '403'){
				SharedService.saveForLog((new Date().toISOString() + ': RestService: ').concat('inside 403 error').concat(response));
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage(response.message);
				SharedService.setFeedbackType("warning");
				newResponse = []; //just doing this as i am not setting payload in sendApiResponse in the backend and might trigger errors later.

				return newResponse;

			}
			/**
			 * This error code is thrown normally when the session has expired and a login is required
			 */

			if(response.status == '403.01'){
				SharedService.saveForLog((new Date().toISOString() + ': RestService: ').concat(response));
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage(response.message);
				SharedService.setFeedbackType("warning");

				if(operation == 'getList'){
					newResponse = []; //make an empty array as angular expects this for getList operations

				}

				//Clear client side logged in status flags.

				SharedService.setAuth(false);
				SharedService.setUser(null);

				return newResponse;

			}

			/**
			 *  Handle response code 401
			 *  When login credentials are wrong
			 */
			if(response.status == '401'){
				SharedService.saveForLog((new Date().toISOString() + ': RestService: ').concat(response.status).concat(response.message));

				SharedService.setShowFeedback(true);
				SharedService.setAuth(false);
				SharedService.setUser(null);
				SharedService.setFeedbackMessage(response.message);
				SharedService.setFeedbackType("warning");
				newResponse = []; //just doing this as i am not setting payload in sendApiResponse in the backend
				return newResponse;
			}
			/**
			 * For handling Internal errors thrown that require administrator attention
			 */

			if(response.status == '500'){

				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage(response.message);
				SharedService.saveForLog((new Date().toISOString() + ': RestService: ').concat(response.status).concat(response.message));

				return newResponse;
			}

			if(response.status == '499'){
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage(response.message);
				SharedService.saveForLog((new Date().toISOString() + ': RestService: User logged in already ').concat(response.status).concat(response.message));
				return newResponse;
			}

			//study specific errors handling
			if(response.status == '500.01' || response.status == '500.02'){
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage(response.message);
				return newResponse;
			}
			//moved below to handle the status codes first
			if(response.apiStatus == "FAILURE"){
				SharedService.saveForLog((new Date().toISOString() + ': RestService: ').concat(response.status).concat('failed'));
				if(response.status == '403.01'){
					//Clear client side logged in status flags.
					SharedService.setAuth(false);
					SharedService.setUser(null);
				}
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage(response.message);
				SharedService.setFeedbackType("warning");
				if(operation == 'getList'){
					response.payload = [];
					return response.payload; //this is required by angularJs and the API does not set a payload
				}
				return;
			}


  		if (newResponse instanceof Array) {
				// newResponse.originalElement =[]; //chrome 38 fix - ashok 21.2.18 vm commented
				newResponse.forEach(function(value, key) {
					newResponse.originalElement[key] = { ...value }; //angular.copy(value);
				});
			}else if (newResponse instanceof Object) {
				newResponse.originalElement = { ...newResponse }; //angular.copy(newResponse);
			}
			return newResponse;
		});

    /*
    * Setting customized messages for errors from serverUpdated
    */

    RestangularConfigurer.setErrorInterceptor(function(response,data,$q){

			SharedService.saveForLog((new Date().toISOString() + ': RestService: ErrorInterceptor **').concat(response));

			/**
			 * clear the SharedService feedback, type & status here
			 */

			SharedService.setShowFeedback(false);
			SharedService.setFeedbackMessage("");
			SharedService.setFeedbackType("");


			//Checking for server/spring generated error codes here. The above are checking the SendApiResponse object.
			//The code 400 is stored in status object by Apache/Tomcat server

      //ERROR 401

			if(response.status == "401"){

				SharedService.setShowFeedback(true);
				SharedService.setAuth(false);
				SharedService.setUser(null);
				if(response.data.message != null){

					SharedService.setFeedbackMessage(response.data.message);
				}
				else{
					SharedService.setFeedbackMessage("Session expired, please login again.");
				}
				SharedService.setFeedbackType("warning");

			}

      //ERROR 415

			if(response.status == "415"){
				console.log("weird 415 error here");
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage("The server is unable to process this post request. Please try again. If error persists, please report it to the administrator");
				SharedService.setFeedbackType("warning");
			}

      //ERROR 403
			if(response.status == "403"){
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage("You are not authorized to view this page.");
				SharedService.setFeedbackType("warning");
			}

			if(response.status == "400"){
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage("The server is unable to process this post request. Please try again. If error persists, please report it to the administrator");
				SharedService.setFeedbackType("warning");
			}

      //ERROR STATUS 500
			if(response.status == "500"){
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage("The server is unable to process this post request. Please try again. If error persists, please report it to the administrator");
				SharedService.setFeedbackType("warning");
			}

      //ERROR STATUS 404 resource not found error
      if(response.status == "404"){
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage("The server could not find a required resource. Please try again. If error persists, please report it to the administrator");
				SharedService.setFeedbackType("warning");
			}

      //ERROR STATUS 0

      if(response.status == "0"){
				SharedService.setShowFeedback(true);
				SharedService.setFeedbackMessage("The server returned error status '0'. Please try again. If error persists, please report it to the administrator");
				SharedService.setFeedbackType("warning");
      }

		});
  });
}
