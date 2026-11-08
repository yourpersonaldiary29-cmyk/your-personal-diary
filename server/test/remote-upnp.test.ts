/**
 * UPnP IGD client (server/src/remote/upnp.ts) against a mock gateway on 127.0.0.1: an SSDP
 * responder (udp) + the description / SOAP control endpoints (http).
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  addPortMapping,
  buildSearch,
  deletePortMapping,
  discoverGateway,
  ensurePortMapping,
  getExternalIp,
  getSpecificPortMapping,
  isPrivateIpv4,
  parseDescription,
  parseSsdpResponse,
  soapEnvelope,
  UpnpError,
} from '../src/remote/upnp';
import { startMockIgd, upnpOptionsFor, type MockIgd, type MockIgdOptions } from './remote-fixtures';

const open: MockIgd[] = [];
afterEach(async () => {
  for (const s of open.splice(0)) await s.close();
});

async function igd(opts: MockIgdOptions = {}): Promise<MockIgd> {
  const m = await startMockIgd(opts);
  open.push(m);
  return m;
}

describe('SSDP / description parsing', () => {
  it('builds an M-SEARCH and parses a 200 answer', () => {
    const q = buildSearch('urn:schemas-upnp-org:service:WANIPConnection:1');
    expect(q).toContain('M-SEARCH * HTTP/1.1\r\n');
    expect(q).toContain('HOST: 239.255.255.250:1900\r\n');
    expect(q).toContain('MAN: "ssdp:discover"\r\n');
    expect(q).toContain('ST: urn:schemas-upnp-org:service:WANIPConnection:1\r\n');
    expect(q.endsWith('\r\n\r\n')).toBe(true);
    expect(parseSsdpResponse('HTTP/1.1 200 OK\r\nLocation: http://192.168.1.1:5000/rootDesc.xml\r\nST: x\r\n\r\n')).toEqual({
      location: 'http://192.168.1.1:5000/rootDesc.xml',
      st: 'x',
    });
    expect(parseSsdpResponse('NOTIFY * HTTP/1.1\r\n\r\n')).toBeNull();
  });

  it('picks the WAN connection service and resolves its control URL (URLBase or the location)', () => {
    const xml =
      '<root><URLBase>http://192.168.1.1:1900/</URLBase><device><serviceList>' +
      '<service><serviceType>urn:schemas-upnp-org:service:Layer3Forwarding:1</serviceType><controlURL>/l3f</controlURL></service>' +
      '<service><serviceType>urn:schemas-upnp-org:service:WANPPPConnection:1</serviceType><controlURL>/ppp</controlURL></service>' +
      '<service><serviceType>urn:schemas-upnp-org:service:WANIPConnection:1</serviceType><controlURL>ctl/ip</controlURL></service>' +
      '</serviceList></device></root>';
    expect(parseDescription(xml, 'http://192.168.1.1:5000/desc.xml')).toEqual({
      serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
      controlUrl: 'http://192.168.1.1:1900/ctl/ip',
    });
    const ppp = xml.replace(/<service><serviceType>urn:schemas-upnp-org:service:WANIPConnection:1[\s\S]*?<\/service>/, '').replace(/<URLBase>.*<\/URLBase>/, '');
    expect(parseDescription(ppp, 'http://192.168.1.1:5000/desc.xml')).toEqual({
      serviceType: 'urn:schemas-upnp-org:service:WANPPPConnection:1',
      controlUrl: 'http://192.168.1.1:5000/ppp',
    });
    expect(parseDescription('<root/>', 'http://192.168.1.1/')).toBeNull();
  });

  it('escapes SOAP arguments', () => {
    const env = soapEnvelope('urn:x', 'AddPortMapping', [['NewPortMappingDescription', 'A & <B>']]);
    expect(env).toContain('<NewPortMappingDescription>A &amp; &lt;B&gt;</NewPortMappingDescription>');
    expect(env).toContain('<u:AddPortMapping xmlns:u="urn:x">');
  });

  it('private address ranges', () => {
    for (const ip of ['10.0.0.1', '172.16.5.4', '172.31.255.255', '192.168.1.1', '169.254.1.1']) expect(isPrivateIpv4(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '172.32.0.1', '100.64.0.1', '127.0.0.1', 'fe80::1']) expect(isPrivateIpv4(ip)).toBe(false);
  });
});

describe('discoverGateway + SOAP actions (mock gateway)', () => {
  it('finds the gateway over SSDP and its control URL', async () => {
    const m = await igd();
    const gw = await discoverGateway(upnpOptionsFor(m));
    expect(gw).not.toBeNull();
    expect(gw).toMatchObject({
      serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
      controlUrl: `http://127.0.0.1:${m.httpPort}/ctl/IPConn`,
      localAddress: '127.0.0.1',
    });
    expect(m.searches).toContain('urn:schemas-upnp-org:service:WANIPConnection:1');
    expect(m.searches).toContain('urn:schemas-upnp-org:device:InternetGatewayDevice:2');
  });

  it('adds (TCP, lease 0, product name), reads back, reads the external IP and deletes the mapping', async () => {
    const m = await igd({ externalIp: '198.51.100.20' });
    const gw = (await discoverGateway(upnpOptionsFor(m)))!;
    await addPortMapping(gw, { externalPort: 443, internalPort: 8443, internalClient: '127.0.0.1', description: 'Your Personal Diary' });
    const add = m.actions.find((a) => a.action === 'AddPortMapping')!;
    expect(add.args).toEqual({
      NewRemoteHost: '',
      NewExternalPort: '443',
      NewProtocol: 'TCP',
      NewInternalPort: '8443',
      NewInternalClient: '127.0.0.1',
      NewEnabled: '1',
      NewPortMappingDescription: 'Your Personal Diary',
      NewLeaseDuration: '0',
    });
    expect(await getSpecificPortMapping(gw, 443)).toEqual({ internalClient: '127.0.0.1', internalPort: 8443, description: 'Your Personal Diary' });
    expect(await getExternalIp(gw)).toBe('198.51.100.20');
    await deletePortMapping(gw, 443);
    expect(m.mappings.has(443)).toBe(false);
    expect(await getSpecificPortMapping(gw, 443)).toBeNull();
  });

  it('ensurePortMapping: keeps our identical mapping, replaces ours with another internal port, never touches another device', async () => {
    const m = await igd({ foreignMappings: { 8080: '192.168.1.77' } });
    const gw = (await discoverGateway(upnpOptionsFor(m)))!;
    const mapping = { externalPort: 443, internalPort: 443, internalClient: '127.0.0.1', description: 'Your Personal Diary' };
    expect(await ensurePortMapping(gw, mapping)).toBe('added');
    expect(await ensurePortMapping(gw, mapping)).toBe('added'); // the mock accepts an identical re-add
    expect(await ensurePortMapping(gw, { ...mapping, internalPort: 8443 })).toBe('added');
    expect(m.mappings.get(443)?.internalPort).toBe(8443);
    expect(m.actions.map((a) => a.action)).toContain('DeletePortMapping');
    const err = await ensurePortMapping(gw, { ...mapping, externalPort: 8080 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpnpError);
    expect((err as UpnpError).code).toBe(718);
    expect((err as UpnpError).message).toBe('192.168.1.77');
    expect(m.mappings.get(8080)?.internalClient).toBe('192.168.1.77');
  });

  it('SOAP faults carry the UPnP error code', async () => {
    const m = await igd({ addFault: 725 });
    const gw = (await discoverGateway(upnpOptionsFor(m)))!;
    const err = await addPortMapping(gw, { externalPort: 443, internalPort: 443, internalClient: '127.0.0.1', description: 'x' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpnpError);
    expect((err as UpnpError).code).toBe(725);
  });

  it('ignores answers whose description URL points at another host, and loopback gateways unless allowed', async () => {
    const redirect = await igd({ locationHost: '127.0.0.2' });
    expect(await discoverGateway(upnpOptionsFor(redirect))).toBeNull();
    const m = await igd();
    expect(await discoverGateway({ ...upnpOptionsFor(m), allowLoopback: false })).toBeNull();
  });

  it('returns null when nobody answers', async () => {
    const m = await igd({ serviceType: 'urn:schemas-upnp-org:service:SomethingElse:1' });
    const started = Date.now();
    expect(await discoverGateway({ ...upnpOptionsFor(m), timeoutMs: 400 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
