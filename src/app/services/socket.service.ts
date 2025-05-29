import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Game } from '../models/game'; // Assure-toi que ce fichier existe
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket;
  chemin = "https://solapp.onrender.com";
  private readonly SERVER_URL = this.chemin; // à adapter selon ton backend

  constructor() {
    // Connexion au serveur Socket.IO
    this.socket = io(this.SERVER_URL, {
      transports: ['websocket'], // forcer l'utilisation de WebSocket
    });
  }

  // Envoyer un objet Game au serveur
  sendGame(game: Game): void {
    this.socket.emit('game', game);
  }

  // Écouter les objets Game envoyés par le serveur
  onGame(callback: (game: Game) => void): void {
    this.socket.on('game', callback);
  }

  // Supprimer l’écoute pour éviter les fuites mémoire
  offGame(): void {
    this.socket.off('game');
  }

  // Déconnecter proprement
  disconnect(): void {
    this.socket.disconnect();
  }

  // Se reconnecter si besoin
  reconnect(): void {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  listen<T>(eventName: string): Observable<T> {
    return new Observable<T>(subscriber => {
      this.socket.on(eventName, (data: T) => {
        subscriber.next(data);
      });
      // Optionnel : nettoyer l'écoute quand l'observable est unsubscribed
      return () => this.socket.off(eventName);
    });
  }

  joinGameRoom(gameId: string): void {
    this.socket.emit('join-game-room', gameId);
  }

  emit(eventName: string, data?: any): void {
    this.socket.emit(eventName, data);
  }
}