import {
  Controller,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ApiClient } from 'twitch';
import { StaticAuthProvider } from 'twitch-auth';
import { ChatClient } from 'twitch-chat-client';
import { TwitchPrivateMessage } from 'twitch-chat-client/lib/StandardCommands/TwitchPrivateMessage';
import { ConfigService } from "@nestjs/config";

@Controller()
export class AppController
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private authProvider: StaticAuthProvider;
  private apiClient: ApiClient;
  private chatClient: ChatClient;

  constructor(private readonly configService: ConfigService) {
    const clientId = this.configService.get<string>('TWITCH_CLIENT_ID', '')
    const accessToken = this.configService.get<string>('TWITCH_ACCESS_TOKEN', '');
    const channelsString = this.configService.get<string>('TWITCH_CHANNELS', '');

    Logger.debug({ clientId, accessToken, channelsString }, 'App')
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
    const clientId = this.configService.get<string>('TWITCH_CLIENT_ID', '')
    const accessToken = this.configService.get<string>('TWITCH_ACCESS_TOKEN', '');
    this.authProvider = new StaticAuthProvider(clientId, accessToken);
  }

  private setupApiClient(): void {
    this.apiClient = new ApiClient({ authProvider: this.authProvider });
  }

  private setupChatClient(): void {
    const channelsString = this.configService.get<string>('TWITCH_CHANNELS', '');
    const channels = channelsString.split(',');
    this.chatClient = new ChatClient(this.authProvider, {
      channels: [...channels],
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
      Logger.debug({ channel, user }, 'Join');
    });
  }

  private async partEvent(): Promise<void> {
    this.chatClient.onPart((channel: string, user: string) => {
      Logger.debug({ channel, user }, 'Part');
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
