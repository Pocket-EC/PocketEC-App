interface parameters{
  Tx: string;
  TxAsString: boolean;
  RxAsString: boolean;
  Rx: string;
  RxLength: string;
  Process: string;
}
interface setting{
  description: string;
  command:string;
}
interface registerOptions{
  description:string;
  SETTING: [setting];
}
interface configJSON{
  responseDelimiter: string; //Ex: "\r\n"
  test: parameters;
  readData: parameters;
  readTemperature:parameters;
  setConfigMode:parameters;
  setRegisters:parameters;
  setRegisterModeData: string;
  setRegisterModeTemp: string;
  parkingMode: string;
  REFCN:[registerOptions];
  TIACN:[registerOptions];
}
