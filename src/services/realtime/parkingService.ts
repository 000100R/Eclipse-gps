import { Location, ParkingLocation } from '../../types';

export class ParkingService {
  private parkingLots: ParkingLocation[] = [
    {
      id: 'parking-1',
      name: 'Lake Town VIP Parking',
      location: { lat: 22.5985, lng: 88.4032 },
      totalSpots: 150,
      availableSpots: 12,
      status: 'full',
    },
    {
      id: 'parking-2',
      name: 'Bowbazar Public Garage',
      location: { lat: 22.5695, lng: 88.3681 },
      totalSpots: 200,
      availableSpots: 98,
      status: 'moderate',
    },
    {
      id: 'parking-3',
      name: 'Ballygunge Cultural Parking',
      location: { lat: 22.5295, lng: 88.3655 },
      totalSpots: 80,
      availableSpots: 55,
      status: 'easy',
    },
    {
      id: 'parking-4',
      name: 'Rabindra Sarobar Parking Area',
      location: { lat: 22.5115, lng: 88.3581 },
      totalSpots: 300,
      availableSpots: 14,
      status: 'full',
    },
    {
      id: 'parking-5',
      name: 'Science City Main Parking',
      location: { lat: 22.5401, lng: 88.3972 },
      totalSpots: 500,
      availableSpots: 410,
      status: 'easy',
    },
  ];

  async getParkingLots(): Promise<ParkingLocation[]> {
    return this.parkingLots;
  }

  async getParkingNearLocation(location: Location, maxRadius: number = 2000): Promise<ParkingLocation[]> {
    // Calculate Haversine distance and sort
    const withDistance = this.parkingLots.map(lot => {
      const dist = this.getHaversineDistance(location, lot.location);
      return { ...lot, distance: dist };
    });

    return withDistance
      .filter(lot => lot.distance !== undefined && lot.distance <= maxRadius)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  private getHaversineDistance(p1: Location, p2: Location): number {
    const R = 6371e3;
    const phi1 = (p1.lat * Math.PI) / 180;
    const phi2 = (p2.lat * Math.PI) / 180;
    const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180;
    const deltaLambda = ((p2.lng - p1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const parkingService = new ParkingService();
export const ParkingServiceProvider = parkingService;
