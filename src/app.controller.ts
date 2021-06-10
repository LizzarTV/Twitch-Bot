import {
  Controller,
  HttpService,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ApiClient } from 'twitch';
import { StaticAuthProvider } from 'twitch-auth';
import { TwitchPrivateMessage } from 'twitch-chat-client/lib/StandardCommands/TwitchPrivateMessage';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private authProvider: StaticAuthProvider;
  private apiClient: ApiClient;

  private readonly twitchClient: string;
  private readonly twitchToken: string;
  private readonly channels: string[];
  private readonly daprPort: number;
  private readonly daprBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.twitchClient = this.configService.get<string>('TWITCH_CLIENT_ID', '');
    this.twitchToken = this.configService.get<string>(
      'TWITCH_ACCESS_TOKEN',
      '',
    );
    this.channels = this.configService
      .get<string>('TWITCH_CHANNELS', '')
      .split(',');
    this.daprPort = this.configService.get<number>('DAPR_HTTP_PORT', 3500);
    this.daprBaseUrl = `http://localhost:${this.daprPort}/v1.0/invoke/`;
  }

  public async onApplicationBootstrap(): Promise<void> {
    Logger.debug('Application bootstraps...', 'TwitchBot');
    this.setupAuthProvider();
    this.setupApiClient();
    this.setupChatClient();
    await this.connectChat();
  }

  public onApplicationShutdown(signal?: string): void {
    Logger.debug(`Application shuts down with Signal: ${signal}`, 'TwitchBot');
    this.chatClient.quit();
  }

  private setupAuthProvider(): void {
    this.authProvider = new StaticAuthProvider(
      this.twitchClient,
      this.twitchToken,
    );
  }

  private setupApiClient(): void {
    this.apiClient = new ApiClient({ authProvider: this.authProvider });
  }

  private setupChatClient(): void {
    this.chatClient = new ChatClient(this.authProvider, {
      channels: [...this.channels],
      requestMembershipEvents: true,
    });
  }

  private async connectChat(): Promise<void> {
    this.chatClient
      .connect()
      .then(() => {
        this.joinEvent();
        this.partEvent();
        this.chatEvent();
        this.hostEvent();
        this.hostedEvent();
      })
      .catch(() => {
        Logger.error('Error in Connection');
      });
  }

  private async joinEvent(): Promise<void> {
    this.chatClient.onJoin((channel: string, user: string) => {
      this.httpService
        .post(
          `${this.daprBaseUrl}/twitch-users/method/join`,
          { channel, user },
        )
        .toPromise()
        .catch((error) => {
          Logger.error(error, 'Join');
        });
    });
  }

  private async partEvent(): Promise<void> {
    this.chatClient.onPart((channel: string, user: string) => {
      this.httpService
        .post(
          `${this.daprBaseUrl}/twitch-users/method/part`,
          { channel, user },
        )
        .toPromise()
        .catch((error) => {
          Logger.error(error, 'Part');
        });
    });
  }

  private async chatEvent(): Promise<void> {
    this.chatClient.onMessage(
      (
        channel: string,
        user: string,
        message: string,
        misc: TwitchPrivateMessage,
      ) => {
        const miscObject = {
          id: misc.id,
          user: {
            displayName: misc.userInfo.displayName,
            userType: misc.userInfo.userType,
            color: misc.userInfo.color,
            isBroadcaster: misc.userInfo.isBroadcaster,
            isSubscriber: misc.userInfo.isSubscriber,
            isFounder: misc.userInfo.isFounder,
            isMod: misc.userInfo.isMod,
            isVip: misc.userInfo.isVip,
            isCheer: misc.isCheer,
            totalBits: misc.bits,
            badges: Array.from(misc.userInfo.badges.keys()),
          },
        };
        Logger.debug({ channel, user, message, misc: miscObject }, 'Chat');
      },
    );
  }

  private async hostEvent(): Promise<void> {
    this.chatClient.onHost(
      (channel: string, target: string, viewers?: number) => {
        Logger.debug({ channel, target, viewers: viewers || 0 }, 'Host');
      },
    );
  }

  private async hostedEvent(): Promise<void> {
    this.chatClient.onHosted(
      (channel: string, byChannel: string, auto: boolean, viewers?: number) => {
        Logger.debug(
          { channel, byChannel, auto, viewers: viewers || 0 },
          'Hosted',
        );
      },
    );
  }
}
