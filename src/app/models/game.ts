export interface Game {
    _id: string;
    player: string;
    playerPseudo: string;
    choice: string;
    amount: number;
    status: string;
    opponent?: string;
    opponentPseudo?: string;
    result?: 'pile' | 'face' | undefined;
    winner?: string;
    lock?: boolean;
  }