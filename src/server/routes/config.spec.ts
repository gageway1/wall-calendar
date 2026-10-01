import { wifiQrPayload } from './config';

describe('wifiQrPayload', () => {
  it('builds the standard Wi-Fi QR string', () => {
    expect(
      wifiQrPayload({ ssid: 'Home', password: 'hunter22', security: 'WPA', hidden: false }),
    ).toBe('WIFI:T:WPA;S:Home;P:hunter22;;');
  });

  it('escapes special characters and marks hidden networks', () => {
    expect(
      wifiQrPayload({ ssid: 'My;Net', password: 'a:b,c"d\\e', security: 'WPA', hidden: true }),
    ).toBe('WIFI:T:WPA;S:My\\;Net;P:a\\:b\\,c\\"d\\\\e;H:true;;');
  });

  it('omits the password for open networks', () => {
    expect(wifiQrPayload({ ssid: 'Guest', password: '', security: 'nopass', hidden: false })).toBe(
      'WIFI:T:nopass;S:Guest;;',
    );
  });
});
