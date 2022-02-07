interface user{
  id: number;
  email: string;
  password: string;
  name: string;
  uniqueToken: string; //sent by server on logging in.
  localDbId: number; //set by app on creating local database rowid.
}
