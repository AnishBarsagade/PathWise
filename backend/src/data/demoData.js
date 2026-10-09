// Deterministic, fictional PathWise demonstration records. Coordinates are
// zone-centred demo points, not verified customer addresses or road locations.
const zones = [
  ['Dighori', 21.1525, 79.1390], ['Nandanvan', 21.1340, 79.1215],
  ['Sitabuldi', 21.1465, 79.0880], ['Dharampeth', 21.1390, 79.0600],
  ['Sadar', 21.1605, 79.0800], ['Civil Lines', 21.1530, 79.0735],
  ['Manish Nagar', 21.1040, 79.0505], ['Wardha Road', 21.1070, 79.0610],
  ['Pratap Nagar', 21.1165, 79.0605], ['Hingna MIDC', 21.1160, 79.0040],
  ['MIHAN', 21.0920, 79.0450], ['Besa', 21.1020, 79.1010],
  ['Narendra Nagar', 21.1175, 79.0880], ['Trimurti Nagar', 21.1260, 79.0450],
  ['Mankapur', 21.1780, 79.1050], ['Itwari', 21.1540, 79.1130],
  ['Sakkardara', 21.1275, 79.1120], ['Medical Square', 21.1350, 79.1020],
  ['Lakadganj', 21.1450, 79.1230], ['Ajni', 21.1260, 79.0820],
];

const fleet = [
  ['Hero','Splendor Plus','XTEC','motorcycle','Petrol',20], ['Honda','Shine','125','motorcycle','Petrol',20],
  ['Bajaj','Pulsar','125','motorcycle','Petrol',18], ['TVS','Raider','125','motorcycle','Petrol',18],
  ['Hero','Splendor Plus','XTEC','motorcycle','Petrol',20], ['Honda','Shine','125','motorcycle','Petrol',20],
  ['Honda','Activa','6G','scooter','Petrol',15], ['TVS','Jupiter','125','scooter','Petrol',15],
  ['Suzuki','Access','125','scooter','Petrol',15], ['TVS','iQube','ST','electric two-wheeler','Electric',12],
  ['Tata','Ace Gold','Petrol','cargo three-wheeler','Petrol',500], ['Mahindra','Jeeto','Plus','cargo three-wheeler','Diesel',600],
  ['Tata','Intra','V10','mini-truck','Diesel',1000], ['Mahindra','Supro','Profit Truck','mini-truck','Diesel',900],
  ['Ashok Leyland','Dost','Strong','mini-truck','Diesel',1000], ['Tata','Yodha','1700','pickup','Diesel',1200],
  ['Mahindra','Bolero','Maxx Pik-Up','pickup','Diesel',1000], ['Tata','Yodha','1500','pickup','Diesel',1100],
  ['Mahindra','Bolero','Camper','pickup','Diesel',900], ['Ashok Leyland','Bada Dost','i2','light commercial vehicle','Diesel',1250],
];

const categories = [
  ['Documents and envelopes', 0.4], ['Clothing and apparel', 2.5], ['Grocery parcels', 7],
  ['Small electronics', 3], ['Books and educational supplies', 5], ['Pharmacy parcels', 1],
  ['Food and household items', 9], ['Small commercial packages', 18],
  ['Industrial components', 85], ['Larger business consignments', 230],
];
const names = ['Aarav Kulkarni','Diya Deshmukh','Rohan Patil','Isha Joshi','Vivaan Bhosale','Anaya Wagh','Arjun Gawande','Kavya Shinde','Reyansh Pawar','Meera Tiwari'];

function demoVehicles() {
  return fleet.map((v, i) => ({
    vehicle_id: `V${String(i + 1).padStart(3, '0')}`, manufacturer: v[0], model: v[1], variant: v[2],
    vehicle_class: v[3], fuel_type: v[4], registration_identifier: `SYN-MH31-PW-${String(i + 1).padStart(3, '0')}`,
    configured_capacity_kg: v[5], manufacturer_rated_payload_kg: null,
    availability: i !== 19 ? 1 : 0, operational_status: i !== 19 ? 'available' : 'maintenance', is_demo: 1,
  }));
}

function demoDeliveries() {
  return Array.from({ length: 100 }, (_, i) => {
    const [zone, lat, lon] = zones[i % zones.length];
    const [category, baseWeight] = categories[i % categories.length];
    const priority = i % 10 < 2 ? 'High' : i % 10 < 6 ? 'Medium' : 'Low';
    return {
      delivery_id: `D${String(i + 1).padStart(4, '0')}`, recipient_name: names[i % names.length], parcel_category: category,
      weight: Number((baseWeight + ((i * 7) % 5) * (baseWeight < 20 ? 0.2 : 4)).toFixed(1)), priority,
      location: `Synthetic demo location ${i + 1}, ${zone}, Nagpur`, zone,
      latitude: Number((lat + ((i % 5) - 2) * 0.0011).toFixed(6)), longitude: Number((lon + ((i % 7) - 3) * 0.0010).toFixed(6)),
      status: 'pending', is_demo: 1,
    };
  });
}

module.exports = { demoVehicles, demoDeliveries, zones };
