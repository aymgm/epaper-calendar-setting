'use client';
import { PackedBinaryImage } from "./BinaryImage";

export class SimpleBluetooth {
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder('utf-8');
  private recvCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
  private sendCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;

  public async connect(params: {
    deviceName: string;
    onReceived: (value: string) => void;
  }) {
    const td = this.textDecoder;
    function onReceivedWrapper(this: BluetoothRemoteGATTCharacteristic): void {
      const v = this.value;
      if (v === undefined) {
        return;
      }
      const str = td.decode(v);
      params.onReceived(str);
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [{
        name: params.deviceName
      }],
      optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']
    });

    const server = await device.gatt?.connect();
    if (server === undefined) throw new Error("GATT server not provided");

    const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');

    this.sendCharacteristic = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
    this.recvCharacteristic = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');

    this.recvCharacteristic.addEventListener('characteristicvaluechanged', onReceivedWrapper);

    await this.recvCharacteristic.startNotifications().catch(e => {
      this.recvCharacteristic?.removeEventListener('characteristicvaluechanged', onReceivedWrapper);
      throw e;
    });

    console.log(`connected with ${device.name}`)

  }

  public async sendString(str: string) {
    if (this.sendCharacteristic === undefined) {
      throw new Error("Bluetooth device not connected");
    }
    const payload = this.textEncoder.encode(str);
    const windowSize = 512;
    const chunkSize = Math.ceil(payload.length / windowSize);

    for (let i = 0; i < chunkSize; i++) {
      const chunk = payload.slice(i * windowSize, Math.min((i + 1) * windowSize, payload.length));
      await this.sendCharacteristic.writeValueWithoutResponse(chunk);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    await this.sendCharacteristic.writeValueWithoutResponse(new Uint8Array());
    console.log("string sent")
  }

  public async sendPackedData(data: PackedBinaryImage) {
    if (this.sendCharacteristic === undefined) {
      throw new Error("Bluetooth device not connected");
    }
    const payload = data.data;
    const windowSize = 512;
    const chunkSize = Math.ceil(data.data.length / windowSize);

    for (let i = 0; i < chunkSize; i++) {
      const chunk = payload.slice(i * windowSize, Math.min((i + 1) * windowSize, payload.length));
      await this.sendCharacteristic.writeValueWithoutResponse(chunk);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    await this.sendCharacteristic.writeValueWithoutResponse(new Uint8Array());
  }
}
