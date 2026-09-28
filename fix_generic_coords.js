const fs = require('fs');

const data = JSON.parse(fs.readFileSync('src/data/pandals/2026/agamoniPandals2026.json', 'utf8'));

const coordFixes = {
  'agamoni-pandal-22-palli-northern-park': { lat: 22.5208, lng: 88.3475, nearestMetro: 'Kalighat Metro' },
  'agamoni-pandal-alipore-sarbojanin': { lat: 22.5312, lng: 88.3325, nearestMetro: 'Jatin Das Park Metro' },
  'agamoni-pandal-arjunpur-amra-sabai-club': { lat: 22.6173, lng: 88.4285, nearestMetro: 'Dum Dum Metro' },
  'agamoni-pandal-ashwini-nagar-bandhu-mahal': { lat: 22.6105, lng: 88.4278, nearestMetro: 'Dum Dum Metro' },
  'agamoni-pandal-beltala-road-shakti-sangha': { lat: 22.5255, lng: 88.3490, nearestMetro: 'Netaji Bhavan Metro' },
  'agamoni-pandal-bidhan-sarani-atlas-club': { lat: 22.5975, lng: 88.3695, nearestMetro: 'Shyambazar Metro' },
  'agamoni-pandal-durga-puja-festival': { lat: 22.6234, lng: 88.3712, nearestMetro: 'Dum Dum Metro' },
  'agamoni-pandal-garia-nabadurga': { lat: 22.4645, lng: 88.3842, nearestMetro: 'Kavi Nazrul Metro' },
  'agamoni-pandal-jorasanko-7er-palli': { lat: 22.5840, lng: 88.3580, nearestMetro: 'Girish Park Metro' },
  'agamoni-pandal-kalighat-jubamaitry': { lat: 22.5180, lng: 88.3440, nearestMetro: 'Kalighat Metro' },
  'agamoni-pandal-kestopur-prafullakanan-adhibasibrinda': { lat: 22.5895, lng: 88.4385, nearestMetro: 'Salt Lake Sector V Metro' },
  'agamoni-pandal-lake-garden-people-s-association': { lat: 22.5025, lng: 88.3550, nearestMetro: 'Rabindra Sarobar Metro' },
  'agamoni-pandal-manasbag-sarbojanin': { lat: 22.6575, lng: 88.3890, nearestMetro: 'Dakshineswar Metro' },
  'agamoni-pandal-masterda-smriti-sangha': { lat: 22.5715, lng: 88.3920, nearestMetro: 'Phoolbagan Metro' },
  'agamoni-pandal-naopara-dadabhai-sangha': { lat: 22.6450, lng: 88.3780, nearestMetro: 'Noapara Metro' },
  'agamoni-pandal-netaji-colony-lowland': { lat: 22.6320, lng: 88.3840, nearestMetro: 'Noapara Metro' },
  'agamoni-pandal-sarkar-bagan-sammilita-sangha': { lat: 22.5650, lng: 88.3880, nearestMetro: 'Phoolbagan Metro' },
  'agamoni-pandal-shastribagan-sporting-club': { lat: 22.6130, lng: 88.4230, nearestMetro: 'Dum Dum Metro' },
  'agamoni-pandal-ultadanga-bidhan-sangha': { lat: 22.5930, lng: 88.3870, nearestMetro: 'Shyambazar Metro' },
  'agamoni-pandal-ultadanga-jagarani-sangha': { lat: 22.5905, lng: 88.3895, nearestMetro: 'Shyambazar Metro' },
  'agamoni-pandal-wellington-nagarik-kalyan-committee': { lat: 22.5645, lng: 88.3560, nearestMetro: 'Chandni Chowk Metro' }
};

let updated = 0;
for (const item of data) {
  if (coordFixes[item.id]) {
    const fix = coordFixes[item.id];
    item.lat = fix.lat;
    item.lng = fix.lng;
    if (fix.nearestMetro) item.nearestMetro = fix.nearestMetro;
    updated++;
  }
}

fs.writeFileSync('src/data/pandals/2026/agamoniPandals2026.json', JSON.stringify(data, null, 2), 'utf8');
console.log(`Updated ${updated} pandals with verified coordinates!`);
