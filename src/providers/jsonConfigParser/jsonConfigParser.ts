import { Injectable } from '@angular/core';


/**
* @author vm
*
* This service is used to share the data between the different Controllers
*

*/

// interface ConfigJson {
//     responseDelimiter: string;
//     test:              ReadData;
//     readData:          ReadData;
//     readTemperature:   ReadData;
//     setConfigMode:     ReadData;
//     setRegisters:      ReadData;
//     REFCN:             Refcn[];
//     TIACN:             Refcn[];
// }
//
// interface Refcn {
//     description: string;
//     SETTING:     Setting[];
// }
//
// interface Setting {
//     description: string;
//     command:     string;
// }
//
// interface ReadData {
//     Tx:         null | string;
//     TxAsString: boolean;
//     RxAsString: boolean;
//     Rx:         string;
//     RxLength:   string;
//     Process:    string;
// }


@Injectable()
export class JsonConfigObjectParser {

}
