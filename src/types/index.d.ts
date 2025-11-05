declare namespace Express {
  export interface Request {
    user?: { id: string; userId: string; email: string , userPrefId: string};
    rawBody: any;
  }
}
