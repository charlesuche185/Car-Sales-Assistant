export type Vehicle = {
  id: string;
  name: string;
  year: number;
  price: number;
  mileage: number;
  transmission: string;
  fuel: string;
};

export const inventory: Vehicle[] = [
  { id: 'camry-2020', name: 'Toyota Camry 2020', year: 2020, price: 18_500_000, mileage: 72_000, transmission: 'Automatic', fuel: 'Petrol' },
  { id: 'accord-2020', name: 'Honda Accord 2020', year: 2020, price: 17_000_000, mileage: 68_000, transmission: 'Automatic', fuel: 'Petrol' },
  { id: 'corolla-2021', name: 'Toyota Corolla 2021', year: 2021, price: 16_500_000, mileage: 55_000, transmission: 'Automatic', fuel: 'Petrol' },
  { id: 'rx-350-2019', name: 'Lexus RX 350 2019', year: 2019, price: 28_000_000, mileage: 81_000, transmission: 'Automatic', fuel: 'Petrol' },
  { id: 'c300-2020', name: 'Mercedes-Benz C300 2020', year: 2020, price: 32_000_000, mileage: 61_000, transmission: 'Automatic', fuel: 'Petrol' },
  { id: 'elantra-2021', name: 'Hyundai Elantra 2021', year: 2021, price: 14_500_000, mileage: 49_000, transmission: 'Automatic', fuel: 'Petrol' },
];