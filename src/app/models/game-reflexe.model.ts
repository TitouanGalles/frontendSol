export interface ReflexeGame {
  _id: string;
  host: {
    pseudo: string;
    wallet: string;
  };
  opponent?: {
    pseudo: string;
    wallet: string;
  };
  amount: number;
  status: 'waiting' | 'en cours' | 'terminée';
  winner?: string;
  hostTime?: String;
  opponentTime?: String;
  lock: boolean;
}
