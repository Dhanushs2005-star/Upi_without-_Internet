/**
 * VirtualDevice
 * Corresponds to VirtualDevice.java in the Spring Boot project.
 * Represents a simulated phone in the mesh holding packets it has received.
 */
export class VirtualDevice {
  constructor(deviceId, hasInternet = false) {
    this.deviceId = deviceId;
    this.hasInternet = hasInternet;
    this.heldPackets = new Map(); // packetId -> MeshPacket
  }

  hold(packet) {
    if (!packet || !packet.packetId) return;
    if (!this.heldPackets.has(packet.packetId)) {
      this.heldPackets.set(packet.packetId, { ...packet });
    }
  }

  getHeldPackets() {
    return Array.from(this.heldPackets.values());
  }

  holds(packetId) {
    return this.heldPackets.has(packetId);
  }

  packetCount() {
    return this.heldPackets.size;
  }

  clear() {
    this.heldPackets.clear();
  }
}

/**
 * MeshSimulatorService
 * Corresponds to MeshSimulatorService.java in the Spring Boot project.
 *
 * Simulates a Bluetooth mesh network where phones exchange encrypted payment packets.
 * - Senders inject packets into their local device.
 * - Gossip rounds forward packets to other nearby devices, decrementing TTL per hop.
 * - Devices with internet (bridge nodes) collect held packets to upload to the backend.
 */
export class MeshSimulatorService {
  constructor() {
    this.devices = new Map();
    this.seedDefaultDevices();
  }

  seedDefaultDevices() {
    this.devices.clear();
    this.devices.set('phone-alice', new VirtualDevice('phone-alice', false));
    this.devices.set('phone-stranger1', new VirtualDevice('phone-stranger1', false));
    this.devices.set('phone-stranger2', new VirtualDevice('phone-stranger2', false));
    this.devices.set('phone-stranger3', new VirtualDevice('phone-stranger3', false));
    this.devices.set('phone-bridge', new VirtualDevice('phone-bridge', true));
  }

  getDevices() {
    return Array.from(this.devices.values());
  }

  getDevice(id) {
    return this.devices.get(id);
  }

  /**
   * Drops a packet into the mesh via a specific device (e.g. phone-alice)
   */
  inject(senderDeviceId, packet) {
    const sender = this.devices.get(senderDeviceId);
    if (!sender) {
      throw new Error(`Unknown device: ${senderDeviceId}`);
    }
    sender.hold(packet);
    return sender;
  }

  /**
   * Runs one round of gossip across all devices.
   * Decrements TTL per hop; packets with TTL <= 0 are not forwarded further.
   */
  gossipOnce() {
    let transfers = 0;
    const deviceList = Array.from(this.devices.values());

    // Snapshot state at start of round to avoid forwarding across multiple hops in a single round
    const snapshot = new Map();
    for (const d of deviceList) {
      snapshot.set(d.deviceId, d.getHeldPackets());
    }

    for (const src of deviceList) {
      const heldPackets = snapshot.get(src.deviceId) || [];
      for (const pkt of heldPackets) {
        if (pkt.ttl <= 0) continue;

        for (const dst of deviceList) {
          if (dst.deviceId === src.deviceId) continue;
          if (dst.holds(pkt.packetId)) continue;

          // Clone packet with decremented TTL
          const copy = {
            packetId: pkt.packetId,
            ttl: pkt.ttl - 1,
            createdAt: pkt.createdAt,
            ciphertext: pkt.ciphertext,
          };

          dst.hold(copy);
          transfers++;
        }
      }
    }

    return {
      transfers,
      deviceCounts: this.snapshotMap(),
    };
  }

  snapshotMap() {
    const counts = {};
    for (const [id, d] of this.devices.entries()) {
      counts[id] = d.packetCount();
    }
    return counts;
  }

  /**
   * Collects all packets currently held by devices that have internet access.
   * Simulates the moments bridge devices connect to 4G outside.
   */
  collectBridgeUploads() {
    const uploads = [];
    for (const d of this.devices.values()) {
      if (!d.hasInternet) continue;
      for (const pkt of d.getHeldPackets()) {
        uploads.push({
          bridgeNodeId: d.deviceId,
          packet: { ...pkt },
        });
      }
    }
    return uploads;
  }

  resetMesh() {
    for (const d of this.devices.values()) {
      d.clear();
    }
  }
}

// Export singleton instance
export const meshService = new MeshSimulatorService();
