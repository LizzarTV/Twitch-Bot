import {Controller, Logger, OnApplicationBootstrap, OnApplicationShutdown} from '@nestjs/common';
import TwitchJs from 'twitch-js';
import fetchUtil from "twitch-js/lib/utils/fetch";

@Controller()
export class AppController implements OnApplicationBootstrap, OnApplicationShutdown {

    private twitchClient: TwitchJs;

    constructor() { }

    public onApplicationBootstrap(): void {
        Logger.debug('Application bootstraps...', 'TwitchBot');
        this.initBot();
    }

    public onApplicationShutdown(signal?: string): void {
        Logger.debug(`Application shuts down with Signal: ${signal}`, 'TwitchBot');
        if (this.twitchClient) {
            this.twitchClient.chat.disconnect();
            delete this.twitchClient;
        }
    }

    private initBot(): void {
        const token = '';
        const username = '';
        this.twitchClient = new TwitchJs({ token, username, onAuthenticationFailure: this.onAuthenticationFailure() });
        this.connectBot();
    }

    private onAuthenticationFailure(): () => Promise<string> {
        return () => fetchUtil('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            search: {
                grant_type: 'refresh_token',
                refresh_token: '',
                client_id: '',
                client_secret: '',
            },
            // @ts-ignore
        }).then(response => response?.accessToken || '');
    }

    private connectBot(): void {
        this.twitchClient.chat.connect().then((state) => {
            Logger.debug(state, 'TwitchBot');
        });
    }

}
