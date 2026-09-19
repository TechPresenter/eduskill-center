/**
 * Reference data: Indian States / Union Territories with their districts.
 * This is public administrative data (not demo data). Super Admin can add, edit,
 * deactivate, import and export locations from /admin/locations at any time.
 */
export interface SeedState {
  name: string;
  code: string;
  isUT?: boolean;
  districts: string[];
}

export const STATES: SeedState[] = [
  { name: "Andaman and Nicobar Islands", code: "AN", isUT: true, districts: ["Nicobar", "North and Middle Andaman", "South Andaman"] },
  { name: "Andhra Pradesh", code: "AP", districts: ["Alluri Sitharama Raju", "Anakapalli", "Anantapur", "Annamayya", "Bapatla", "Chittoor", "East Godavari", "Eluru", "Guntur", "Kakinada", "Konaseema", "Krishna", "Kurnool", "Nandyal", "NTR", "Palnadu", "Parvathipuram Manyam", "Prakasam", "Sri Potti Sriramulu Nellore", "Sri Sathya Sai", "Srikakulam", "Tirupati", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"] },
  { name: "Arunachal Pradesh", code: "AR", districts: ["Anjaw", "Changlang", "Dibang Valley", "East Kameng", "East Siang", "Itanagar Capital Complex", "Kamle", "Kra Daadi", "Kurung Kumey", "Leparada", "Lohit", "Longding", "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai", "Pakke-Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang", "Tirap", "Upper Siang", "Upper Subansiri", "West Kameng", "West Siang"] },
  { name: "Assam", code: "AS", districts: ["Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong"] },
  { name: "Bihar", code: "BR", districts: ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"] },
  { name: "Chandigarh", code: "CH", isUT: true, districts: ["Chandigarh"] },
  { name: "Chhattisgarh", code: "CG", districts: ["Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Gaurela-Pendra-Marwahi", "Janjgir-Champa", "Jashpur", "Kabirdham", "Kanker", "Khairagarh-Chhuikhadan-Gandai", "Kondagaon", "Korba", "Koriya", "Mahasamund", "Manendragarh-Chirmiri-Bharatpur", "Mohla-Manpur-Ambagarh Chowki", "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sakti", "Sarangarh-Bilaigarh", "Sukma", "Surajpur", "Surguja"] },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "DD", isUT: true, districts: ["Dadra and Nagar Haveli", "Daman", "Diu"] },
  { name: "Delhi", code: "DL", isUT: true, districts: ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"] },
  { name: "Goa", code: "GA", districts: ["North Goa", "South Goa"] },
  { name: "Gujarat", code: "GJ", districts: ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"] },
  { name: "Haryana", code: "HR", districts: ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"] },
  { name: "Himachal Pradesh", code: "HP", districts: ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"] },
  { name: "Jammu and Kashmir", code: "JK", isUT: true, districts: ["Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"] },
  { name: "Jharkhand", code: "JH", districts: ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj", "Seraikela Kharsawan", "Simdega", "West Singhbhum"] },
  { name: "Karnataka", code: "KA", districts: ["Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayanagara", "Vijayapura", "Yadgir"] },
  { name: "Kerala", code: "KL", districts: ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"] },
  { name: "Ladakh", code: "LA", isUT: true, districts: ["Kargil", "Leh"] },
  { name: "Lakshadweep", code: "LD", isUT: true, districts: ["Lakshadweep"] },
  { name: "Madhya Pradesh", code: "MP", districts: ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena", "Narmadapuram", "Narsinghpur", "Neemuch", "Niwari", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha"] },
  { name: "Maharashtra", code: "MH", districts: ["Ahmednagar", "Akola", "Amravati", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Chhatrapati Sambhajinagar", "Dharashiv", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"] },
  { name: "Manipur", code: "MN", districts: ["Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"] },
  { name: "Meghalaya", code: "ML", districts: ["East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "Eastern West Khasi Hills", "North Garo Hills", "Ri Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"] },
  { name: "Mizoram", code: "MZ", districts: ["Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saiha", "Saitual", "Serchhip"] },
  { name: "Nagaland", code: "NL", districts: ["Chumoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung", "Mon", "Niuland", "Noklak", "Peren", "Phek", "Shamator", "Tseminyu", "Tuensang", "Wokha", "Zunheboto"] },
  { name: "Odisha", code: "OD", districts: ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"] },
  { name: "Puducherry", code: "PY", isUT: true, districts: ["Karaikal", "Mahe", "Puducherry", "Yanam"] },
  { name: "Punjab", code: "PB", districts: ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Firozpur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar", "Sangrur", "Shahid Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran"] },
  { name: "Rajasthan", code: "RJ", districts: ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"] },
  { name: "Sikkim", code: "SK", districts: ["Gangtok", "Gyalshing", "Mangan", "Namchi", "Pakyong", "Soreng"] },
  { name: "Tamil Nadu", code: "TN", districts: ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"] },
  { name: "Telangana", code: "TS", districts: ["Adilabad", "Bhadradri Kothagudem", "Hanumakonda", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Komaram Bheem Asifabad", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"] },
  { name: "Tripura", code: "TR", districts: ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura", "Unakoti", "West Tripura"] },
  { name: "Uttar Pradesh", code: "UP", districts: ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"] },
  { name: "Uttarakhand", code: "UK", districts: ["Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"] },
  { name: "West Bengal", code: "WB", districts: ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"] },
];

/** Preferred 3-letter district codes for well-known districts (used inside center codes). */
export const DISTRICT_CODE_OVERRIDES: Record<string, string> = {
  "WB:Kolkata": "KOL",
  "WB:Howrah": "HWH",
  "BR:Patna": "PAT",
  "UP:Gautam Buddha Nagar": "GBN",
  "UP:Lucknow": "LKO",
  "UP:Varanasi": "VNS",
  "UP:Kanpur Nagar": "KNP",
  "UP:Prayagraj": "PRY",
  "MH:Pune": "PUN",
  "MH:Mumbai City": "MUM",
  "MH:Mumbai Suburban": "MSB",
  "MH:Nagpur": "NGP",
  "KA:Bengaluru Urban": "BLR",
  "KA:Bengaluru Rural": "BLR2",
  "RJ:Jaipur": "JAI",
  "JH:Ranchi": "RAN",
  "AS:Kamrup Metropolitan": "GHY",
  "MP:Bhopal": "BHO",
  "MP:Indore": "IDR",
  "DL:New Delhi": "NDL",
  "TN:Chennai": "CHE",
  "TS:Hyderabad": "HYD",
  "GJ:Ahmedabad": "AMD",
  "OD:Khordha": "BBS",
  "PB:Ludhiana": "LDH",
  "HR:Gurugram": "GGN",
  "KL:Ernakulam": "COK",
};

export function deriveDistrictCode(name: string, taken: Set<string>): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  const candidates: string[] = [];
  candidates.push(letters.slice(0, 3));
  const consonants = letters.replace(/[AEIOU]/g, "");
  candidates.push((letters[0] ?? "") + consonants.slice(1, 3));
  const words = name.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  if (words.length >= 2) candidates.push(words.map((w) => w[0]).join("").slice(0, 3).padEnd(3, letters[1] ?? "X"));
  for (const c of candidates) {
    if (c.length === 3 && !taken.has(c)) return c;
  }
  let i = 2;
  while (taken.has(`${letters.slice(0, 2)}${i}`)) i++;
  return `${letters.slice(0, 2)}${i}`;
}

/**
 * DEMO blocks for the districts that host demo centers. Real block data for all
 * districts can be imported from CSV via /admin/locations/blocks.
 */
export const DEMO_BLOCKS: Record<string, string[]> = {
  "WB:Kolkata": ["Kolkata North", "Kolkata Central", "Kolkata South", "Kolkata East"],
  "WB:South 24 Parganas": ["Sonarpur", "Baruipur", "Bhangar I", "Bishnupur I", "Canning I", "Budge Budge I"],
  "BR:Patna": ["Patna Sadar", "Phulwari Sharif", "Danapur", "Bihta", "Masaurhi", "Barh", "Fatwah", "Punpun"],
  "UP:Gautam Buddha Nagar": ["Bisrakh", "Dadri", "Jewar", "Dankaur"],
  "UP:Lucknow": ["Sarojini Nagar", "Mohanlalganj", "Bakshi Ka Talab", "Malihabad", "Chinhat", "Gosaiganj", "Kakori", "Mall"],
  "MH:Pune": ["Haveli", "Mulshi", "Maval", "Khed", "Junnar", "Shirur", "Baramati", "Daund"],
  "KA:Bengaluru Urban": ["Bengaluru North", "Bengaluru South", "Bengaluru East", "Anekal", "Yelahanka"],
  "RJ:Jaipur": ["Sanganer", "Amber", "Chaksu", "Bassi", "Jhotwara", "Phagi", "Shahpura"],
  "JH:Ranchi": ["Kanke", "Ratu", "Namkum", "Ormanjhi", "Angara", "Mandar", "Bundu"],
  "AS:Kamrup Metropolitan": ["Dimoria", "Chandrapur", "Sonapur", "Guwahati Sadar"],
  "MP:Bhopal": ["Phanda", "Berasia"],
  "DL:South Delhi": ["Mehrauli", "Hauz Khas", "Saket"],
};
