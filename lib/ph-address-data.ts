// Philippine Address Data — Region → Province → City → Barangay + ZIP

export interface PHCity {
  name: string
  zipCode: string
  barangays: string[]
}

export interface PHProvince {
  name: string
  cities: PHCity[]
}

export interface PHRegion {
  name: string
  provinces: PHProvince[]
}

export const PH_REGIONS: PHRegion[] = [
  {
    name: "NCR – National Capital Region",
    provinces: [
      {
        name: "Metro Manila",
        cities: [
          {
            name: "Caloocan City",
            zipCode: "1400",
            barangays: ["Bagong Silang","Camarin","Deparo","Grace Park East","Grace Park West","Llano","Maypajo","Pinyahan","Sangandaan","Tala","Barangay 1","Barangay 2","Barangay 3","Barangay 4","Barangay 5","Barangay 6","Barangay 7","Barangay 8","Barangay 9","Barangay 10","Barangay 11","Barangay 12","Barangay 13","Barangay 14","Barangay 15","Barangay 16","Barangay 17","Barangay 18","Barangay 19","Barangay 20","Barangay 21","Barangay 22","Barangay 23","Barangay 24","Barangay 25","Barangay 26","Barangay 27","Barangay 28","Barangay 29","Barangay 30","Barangay 31","Barangay 32","Barangay 33","Barangay 34","Barangay 35","Barangay 36","Barangay 37","Barangay 38","Barangay 39","Barangay 40","Barangay 41","Barangay 42","Barangay 43","Barangay 44","Barangay 45","Barangay 46","Barangay 47","Barangay 48","Barangay 49","Barangay 50"],
          },
          {
            name: "Las Piñas City",
            zipCode: "1740",
            barangays: ["Almanza Uno","Almanza Dos","BF Homes Las Pinas","Daniel Fajardo","Elias Aldana","Ilaya","Manuyo Uno","Manuyo Dos","Pamplona Uno","Pamplona Dos","Pamplona Tres","Pilar","Pulang Lupa Uno","Pulang Lupa Dos","Real","Salawag","Talon Uno","Talon Dos","Talon Tres","Talon Cuatro","Talon Cinco","Zapote"],
          },
          {
            name: "Makati City",
            zipCode: "1200",
            barangays: ["Bangkal","Bel-Air","Cembo","Comembo","Dasmariñas","East Rembo","Forbes Park","Guadalupe Nuevo","Guadalupe Viejo","Kasilawan","La Paz","Magallanes","Olympia","Palanan","Pembo","Pinagkaisahan","Pio Del Pilar","Pitogo","Poblacion","Post Proper Northside","Post Proper Southside","Rizal","San Antonio","San Isidro","San Lorenzo","Santa Cruz","Singkamas","Tejeros","Urdaneta","West Rembo"],
          },
          {
            name: "Malabon City",
            zipCode: "1470",
            barangays: ["Acuña","Baritan","Bayan-Bayanan","Catmon","Concepcion","Dampalit","Flores","Hulong Duhat","Longos","Maysilo","Muzon","Niugan","Panghulo","Potrero","San Agustin","San Jose","Santolan","Tañong","Tinajeros","Tonsuya","Tugatog"],
          },
          {
            name: "Mandaluyong City",
            zipCode: "1550",
            barangays: ["Addition Hills","Bagong Silang","Barangka Ibaba","Barangka Ilaya","Barangka Itaas","Barangka Drive","Buayang Bato","Burol","Daang Bakal","Hagdang Bato Itaas","Hagdang Bato Libis","Highway Hills","Hulo","Mabini-J. Rizal","Malamig","Mauway","Namayan","New Zañiga","Old Zañiga","Pag-asa","Palatiw","Plainview","Pleasant Hills","Poblacion","San Jose","Vergara","Wack-Wack Greenhills"],
          },
          {
            name: "Manila",
            zipCode: "1000",
            barangays: ["Binondo","Ermita","Intramuros","Malate","Paco","Pandacan","Port Area","Quiapo","Sampaloc","San Andres Bukid","San Miguel","San Nicolas","Santa Ana","Santa Cruz","Santa Mesa","Tondo"],
          },
          {
            name: "Marikina City",
            zipCode: "1800",
            barangays: ["Barangka","Calumpang","Concepcion Uno","Concepcion Dos","Fortune","Jesus dela Peña","Kalumpang","Malanday","Marikina Heights","Nangka","Parang","San Roque","Santa Elena","Santo Niño","Tañong","Tumana"],
          },
          {
            name: "Muntinlupa City",
            zipCode: "1770",
            barangays: ["Alabang","Ayala Alabang","Bayanan","Buli","Cupang","Poblacion","Putatan","Sucat","Tunasan"],
          },
          {
            name: "Navotas City",
            zipCode: "1485",
            barangays: ["Bagumbayan North","Bagumbayan South","Bangculasi","Daanghari","North Bay Blvd North","North Bay Blvd South","San Jose","San Rafael Village","San Roque","Sipac Almacen","Tangos North","Tangos South"],
          },
          {
            name: "Parañaque City",
            zipCode: "1700",
            barangays: ["Baclaran","BF Homes","Don Bosco","Don Galo","La Huerta","Marcelo Green Village","Merville","Moonwalk","San Antonio","San Dionisio","San Isidro","San Martin de Porres","Santo Niño","Sun Valley","Tambo","Vitalez"],
          },
          {
            name: "Pasay City",
            zipCode: "1300",
            barangays: ["Abad Santos","Baclaran","Bagong Hari","Buenamar","Cartimar","Maricaban","Nevada","San Rafael","Santa Clara","Santa Filomena","Taft","Tramo","Victory Village"],
          },
          {
            name: "Pasig City",
            zipCode: "1600",
            barangays: ["Bagong Ilog","Bagong Katipunan","Bambang","Buting","Caniogan","De la Paz","Kalawaan","Kapasigan","Kapitolyo","Malinao","Manggahan","Maybunga","Oranbo","Palatiw","Pinagbuhatan","Pineda","Rosario","Sagad","San Antonio","San Joaquin","San Jose","San Miguel","San Nicolas","Santa Cruz","Santa Lucia","Santa Rosa","Santo Tomas","Santolan","Sumilang","Ugong"],
          },
          {
            name: "Pateros",
            zipCode: "1620",
            barangays: ["Aguho","Magtanggol","San Pedro","San Roque","Santa Ana","Santo Rosario-Kanluran","Santo Rosario-Silangan","Tabacalera"],
          },
          {
            name: "Quezon City",
            zipCode: "1100",
            barangays: ["Alicia","Aurora","Bagong Silangan","Bagumbayan","Batasan Hills","Blue Ridge A","Blue Ridge B","Commonwealth","Culiat","Damayang Lagi","Del Monte","Fairview","Holy Spirit","Horseshoe","Kaligayahan","Kamuning","Katipunan","Krus na Ligas","La Loma","Lagro","Laging Handa","Libis","Malaya","Manresa","Mariana","Masambong","Matandang Balara","Nagkaisang Nayon","New Era","Novaliches Proper","Obrero","Old Capitol Site","Pag-ibig sa Nayon","Payatas","Phil-Am","Project 6","Project 7","Project 8","Ramon Magsaysay","Sacred Heart","San Agustin","San Antonio","San Bartolome","San Isidro Labrador","San Jose","San Martin de Porres","Santa Cruz","Santa Lucia","Santa Monica","Santo Domingo","Santo Niño","Sauyo","Sikatuna Village","Talayan","Talipapa","Tandang Sora","Tatalon","Teacher's Village East","Teacher's Village West","Ugong Norte","West Kamias","West Triangle","White Plains"],
          },
          {
            name: "San Juan City",
            zipCode: "1500",
            barangays: ["Addition Hills","Balong Bato","Batis","Corazon de Jesus","Ermitaño","Greenhills","Isabelita","Kabayanan","Little Baguio","Maytunas","Onse","Pasadeña","Pedro Cruz","Progreso","Rivera","Salapan","San Perfecto","Santa Lucia","Tibagan","West Crame"],
          },
          {
            name: "Taguig City",
            zipCode: "1630",
            barangays: ["Bagong Tanyag","Bambang","Calzada","Central Bicutan","Central Signal Village","Fort Bonifacio","Hagonoy","Katuparan","Lower Bicutan","Maharlika Village","Napindan","New Lower Bicutan","North Daang Hari","North Signal Village","Palingon","Pinagsama","San Miguel","Santa Ana","South Daang Hari","South Signal Village","Tanyag","Tuktukan","Upper Bicutan","Ususan","Wawa","Western Bicutan"],
          },
          {
            name: "Valenzuela City",
            zipCode: "1440",
            barangays: ["Arkong Bato","Bagbaguin","Balangkas","Bignay","Bisig","Canumay East","Canumay West","Coloong","Dalandanan","Gen. T. De Leon","Isla","Lawang Bato","Lingunan","Mabolo","Malanday","Malinta","Mapulang Lupa","Marulas","Maysan","Palasan","Parada","Paso De Blas","Pasolo","Poblacion","Polo","Punturin","Rincon","Tagalag","Ugong","Veinte Reales","Wawang Pulo"],
          },
        ],
      },
    ],
  },
  {
    name: "Region III – Central Luzon",
    provinces: [
      {
        name: "Bulacan",
        cities: [
          {
            name: "Malolos City",
            zipCode: "3000",
            barangays: ["Anilao","Atlag","Babatnin","Bagna","Bagong Bayan","Balayong","Balete","Balite","Bangkal","Barihan","Bayabas","Bayan","Bayanan","Bulihan","Bungahan","Caingin","Calero","Caliligawan","Canalate","Catmon","Cofradia","Dakila","Guinhawa","Ligas","Liyang","Lugam","Mabolo","Mambog","Masile","Matimbo","Mojon","Namayan","Niugan","Pamarawan","Panasahan","San Agustin","San Gabriel","San Juan","San Pablo","Santo Rosario","Santol","Sumapang Bata","Sumapang Matanda","Taal","Tikay"],
          },
          {
            name: "Meycauayan City",
            zipCode: "3020",
            barangays: ["Bagbaguin","Bahay Pare","Bancal","Banga","Bayugo","Gitnang Bahay","Langka","Lawa","Libtong","Liputan","Longos","Malhacan","Pajo","Pandayan","Pantoc","Perez","Poblacion","Saluysoy","Tugatog","Ubihan","Zamora"],
          },
          {
            name: "San Jose Del Monte City",
            zipCode: "3023",
            barangays: ["Assumption","Bagong Buhay I","Bagong Buhay II","Bagong Buhay III","Citrus","Ciudad Real","Dulong Bayan I","Dulong Bayan II","Fatima I","Fatima II","Fatima III","Fatima IV","Fatima V","Francisco Homes-Guijo","Francisco Homes-Mulawin","Gaya-Gaya","Graceville","Gumaok Central","Gumaok East","Gumaok West","Kaybanban","Kaypian","Lawang Pari","Maharlika","Minuyan I","Minuyan II","Minuyan III","Minuyan IV","Minuyan V","Minuyan Proper","Muzon","Paradise III","Poblacion","Presbitero","Remedios I","Remedios II","San Isidro I","San Isidro II","San Manuel I","San Manuel II","San Roque I","San Roque II","Santa Cruz I","Santa Cruz II","Santa Cruz III","Santa Cruz IV","Santa Cruz V","Santo Cristo I","Santo Cristo II","Santo Niño I","Santo Niño II","Sapang Palay Proper","Tungkong Mangga"],
          },
          {
            name: "Marilao",
            zipCode: "3019",
            barangays: ["Abangan Norte","Abangan Sur","Ibayo","Lambakin","Lias","Loma de Gato","Nagbalon","Patubig","Poblacion I","Poblacion II","Saog","Tabing Ilog"],
          },
          {
            name: "Bocaue",
            zipCode: "3018",
            barangays: ["Batia","Biñang 1st","Biñang 2nd","Bolacan","Bundukan","Bunlo","Calvario","Canda","Duhat","Gitnang Bahay","Lolomboy","Paso","Poblacion","Pulo","Santa Ana","Sulucan","Taal"],
          },
          {
            name: "Baliwag",
            zipCode: "3006",
            barangays: ["Bagong Nayon","Bigte","Buisan","Calantipay","Catulinan","Concepcion","Hinukay","Maasim","Pagala","Paitan","Piel","Pinagbarilan","Poblacion","Sabang","San Juan","San Nicolas","San Roque","Santa Barbara","Santo Cristo","Sulivan","Tangos","Tarcan","Tiaong","Tibag","Tilapayong","Virgen delos Remedios"],
          },
          {
            name: "Guiguinto",
            zipCode: "3015",
            barangays: ["Cutcut","Daungan","Ilang-Ilang","Malis","Panginay","Quezon Garden Resort","Santa Cruz","Sta. Cruz na Bato","Tabang","Tiaong","Tuktukan"],
          },
          {
            name: "Pulilan",
            zipCode: "3005",
            barangays: ["Balatong A","Balatong B","Cutcut I","Cutcut II","Dampol I","Dampol II-A","Dampol II-B","Dulong Malabon","Inaon","Longos","Lumbac","Paltok","Penabatan","Poblacion","Santa Peregrina","Santo Cristo","Tiaong","Tibagan"],
          },
        ],
      },
      {
        name: "Pampanga",
        cities: [
          {
            name: "Angeles City",
            zipCode: "2009",
            barangays: ["Agapito del Rosario","Amsic","Anunas","Balibago","Capaya","Claro M. Recto","Cuayan","Cutcut","Cutud","Lourdes North West","Lourdes Sur","Lourdes Sur East","Malabanias","Margot","Mining","Ninoy Aquino","Pampang","Pandan","Pulung Bulu","Pulung Cacutud","Pulung Maragul","Salapungan","San Jose","San Nicolas","Santo Cristo","Santo Domingo","Santo Rosario","Sapalibutad","Sapangbato","Tabun","Virgen Delos Remedios"],
          },
          {
            name: "San Fernando City",
            zipCode: "2000",
            barangays: ["Alasas","Baliti","Bulaon","Calulut","Del Carmen","Del Pilar","Del Rosario","Dolores","Juliana","Lara","Lourdes","Magliman","Maimpis","Malino","Malpitic","Pandaras","Panipuan","Pias","Poblacion","Quebiawan","Saguin","San Agustin","San Felipe","San Isidro","San Jose","San Juan","San Pedro","Santo Niño","Santo Rosario","Sindalan","Telabastagan"],
          },
          {
            name: "Mabalacat City",
            zipCode: "2010",
            barangays: ["Atlu-Bola","Bundagul","Cacutud","Calumpang","Camachiles","Carmencita","Coayman","Dau","Dolores","Duquit","Lakandula","Lourdes","Mabiga","Macapagal","Mamatitang","Mangalit","Marcos Village","Mawaque","Paralayunan","Poblacion","San Francisco","San Joaquin","Santa Ines","Santa Maria","Santo Rosario","Sapang Balen","Sapang Biabas","Tabun"],
          },
        ],
      },
      {
        name: "Nueva Ecija",
        cities: [
          {
            name: "Cabanatuan City",
            zipCode: "3100",
            barangays: ["Aduas Centro","Aduas Norte","Aduas Sur","Bagong Buhay","Bakero","Bakod Bayan","Balite","Bangad","Bantug Norte","Bantug Sur","Barlis","Barrera District","Bernardo District","Bitas","Bonifacio District","Buliran","Caalibangbangan","Cabu","Calawagan","Capitangan","Caridad","Caudillo","Cinco-Cinco","City Supermarket District","Communal","Cruz Roja","Daang Sarile","Dalampang","Dicarma","Dimasalang","Dionisio S. Garcia","Fatima","Federico Cabling","Gatiawin","Gracia","H. Romero","Homesite","Imelda District","Kalikid Norte","Kalikid Sur","Kapitan Pepe","Lagare","Lourdes","M.S. Garcia","Magsaysay District","Malapit","Malaya","Malbago","Marharlika","Maria Theresa","Matadero","Mawinao","Meiling","Memencio","Motrico","NBE Rolling Hills","Pagas","Pagasa","Palagay","Pamaldan","Pantoc","Penaranda","Pinyahan","Rizdelis","Salapungan","San Isidro","San Josef Norte","San Josef Sur","San Juan Accfa","San Roque Norte","San Roque Sur","Santa Arcadia","Santo Niño","Sapang","Sumacab Este","Sumacab Norte","Sumacab Sur","Talipapa","Valle Cruz","Vergara","Villa Ofelia"],
          },
          {
            name: "Gapan City",
            zipCode: "3105",
            barangays: ["Bayanihan","Bungo","Kapalangan","Langla","Mabunga","Mahipon","Malabon","Mapangpang","Martires","Matingkis","Minabor","Napico","Pangarap","Poblacion I","Poblacion II","San Lorenzo","San Vicente","Santiago Norte","Santiago Sur","Silangan","Villa Ofelia","Villarica"],
          },
        ],
      },
    ],
  },
  {
    name: "Region IV-A – CALABARZON",
    provinces: [
      {
        name: "Cavite",
        cities: [
          {
            name: "Bacoor City",
            zipCode: "4102",
            barangays: ["Alima","Aniban I","Aniban II","Aniban III","Aniban IV","Aniban V","Banalo","Bayanan","Campo Santo","Daang Bukid","Digman","Dulong Bayan","Habay I","Habay II","Kaingin","Ligas I","Ligas II","Ligas III","Mabolo I","Mabolo II","Mabolo III","Maliksi I","Maliksi II","Maliksi III","Mambog I","Mambog II","Mambog III","Mambog IV","Mambog V","Molino I","Molino II","Molino III","Molino IV","Molino V","Molino VI","Niog I","Niog II","Niog III","Panapaan I","Panapaan II","Panapaan III","Panapaan IV","Panapaan V","Panapaan VI","Panapaan VII","Panapaan VIII","Poblacion I","Poblacion II","Poblacion III","Poblacion IV","Real I","Real II","Salinas I","Salinas II","Salinas III","Salinas IV","San Nicolas I","San Nicolas II","San Nicolas III","Sineguelasan","Tabing Dagat","Talaba I","Talaba II","Talaba III","Talaba IV","Talaba V","Talaba VI","Talaba VII","Zapote I","Zapote II","Zapote III","Zapote IV","Zapote V"],
          },
          {
            name: "Cavite City",
            zipCode: "4100",
            barangays: ["Barangay I","Barangay II","Barangay III","Barangay IV","Barangay V","Barangay VI","Barangay VII","Barangay VIII","Barangay IX","Barangay X","Caridad","Dalahican","Domicilio","Luyos","Mambog","Pulo","San Antonio"],
          },
          {
            name: "Dasmariñas City",
            zipCode: "4114",
            barangays: ["Burol","Burol I","Burol II","Burol III","Emmanuel Bergado I","Emmanuel Bergado II","Fatima I","Fatima II","Fatima III","Langkaan I","Langkaan II","Luzviminda I","Luzviminda II","Paliparan I","Paliparan II","Paliparan III","Sabang","Salitran I","Salitran II","Salitran III","Salitran IV","Sampaloc I","Sampaloc II","Sampaloc III","Sampaloc IV","Sampaloc V","San Agustin I","San Agustin II","San Agustin III","San Jose","San Miguel I","San Miguel II","San Simon","Santa Lucia I","Santa Lucia II","Santa Maria I","Santa Maria II","Zone I Poblacion","Zone II Poblacion","Zone III Poblacion","Zone IV Poblacion"],
          },
          {
            name: "General Trias City",
            zipCode: "4107",
            barangays: ["Alingaro","Arnaldo Pob.","Bacao I","Bacao II","Bagumbayan Pob.","Biclatan","Buenavista I","Buenavista II","Buenavista III","Governor's Drive","Javalera","Manggahan","Navarro","Panungyanan","Pasong Camachile I","Pasong Camachile II","Pasong Kawayan I","Pasong Kawayan II","Pinagtipunan","San Francisco","San Juan I","San Juan II","Santiago","Santo Domingo I","Santo Domingo II","Tapia","Tejero"],
          },
          {
            name: "Imus City",
            zipCode: "4103",
            barangays: ["Alapan I-A","Alapan I-B","Alapan I-C","Alapan II-A","Alapan II-B","Anabu I-A","Anabu I-B","Anabu I-C","Anabu I-D","Anabu I-E","Anabu II-A","Anabu II-B","Anabu II-C","Anabu II-D","Bagong Silang I","Bagong Silang II","Bayan Luma I","Bayan Luma II","Bayan Luma III","Bayan Luma IV","Bayan Luma V","Bayan Luma VI","Bucandala I","Bucandala II","Bucandala III","Bucandala IV","Bucandala V","Bulihan","Carsadang Bago I","Carsadang Bago II","Magdalo","Maharlika","Malagasang I-A","Malagasang I-B","Malagasang I-C","Malagasang II-A","Malagasang II-B","Medicion I-A","Medicion I-B","Medicion I-C","Medicion I-D","Medicion II-A","Medicion II-B","Medicion II-C","Medicion II-D","Palico I","Palico II","Palico III","Palico IV","Pasong Buaya I","Pasong Buaya II","Tanzang Luma I","Tanzang Luma II","Tanzang Luma III","Tanzang Luma IV","Tanzang Luma V","Tanzang Luma VI","Tinabunan"],
          },
          {
            name: "Tagaytay City",
            zipCode: "4120",
            barangays: ["Asisan","Bagong Tubig","Calabuso","Francisco","Guinhawa Norte","Guinhawa Sur","Iruhin Central","Iruhin East","Iruhin West","Kaybagal Central","Kaybagal East","Kaybagal North","Kaybagal South","Mag-asawang Ilat","Maharlika East","Maharlika West","Maitim 2nd Central","Maitim 2nd East","Maitim 2nd West","Mendez Crossing East","Mendez Crossing West","Neogan","Patutong Malaki Norte","Patutong Malaki Sur","Poco","Silang Junction Norte","Silang Junction Sur","Sungay East","Sungay West","Tolentino East","Tolentino West","Zambal"],
          },
        ],
      },
      {
        name: "Laguna",
        cities: [
          {
            name: "Calamba City",
            zipCode: "4027",
            barangays: ["Bagong Kalsada","Banadero","Banlic","Batino","Bubuyan","Bucal","Bunggo","Burol","Camaligan","Canlubang","Halang","Kay-Anlog","La Mesa","Laguerta","Lawa","Lecheria","Lingga","Looc","Mabato","Makiling","Mapagong","Masili","Maunong","Mayapa","Paciano Rizal","Palingon","Palo-Alto","Pansol","Parian","Punta","Real","Saimsim","Sampiruhan","San Cristobal","San Jose","San Juan","Sirang Lupa","Sucol","Turbina","Ulango","Uwisan"],
          },
          {
            name: "San Pedro City",
            zipCode: "4023",
            barangays: ["Bagong Silang","Calendola","Chrysanthemum","Cuyab","Estrella","Fatima","G.S.I.S.","Landayan","Langgam","Laram","Magsaysay","Maharlika","Narra","Nueva","Pacita I","Pacita II","Poblacion","Riverside","Rosario","Sampaguita Village","San Antonio","United Bayanihan","United Better Living"],
          },
          {
            name: "Santa Rosa City",
            zipCode: "4026",
            barangays: ["Aplaya","Balibago","Caingin","Dila","Dita","Don Jose","Ibaba","Kanluran","Labas","Macabling","Malitlit","Malusak","Market Area Pob.","Pulong Santa Cruz","Santo Domingo","Sinalhan","Tagapo"],
          },
          {
            name: "Biñan City",
            zipCode: "4024",
            barangays: ["Bungahan","Canlalay","Casile","De La Paz","Ganado","Langkiwa","Loma","Maillard","Malaban","Malamig","Mampalasan","Platero","Poblacion","San Antonio","San Francisco","San Jose","San Vicente","Santo Domingo","Santo Niño","Santo Tomas","Soro-soro Ibaba","Soro-soro Ilaya","Soro-soro Kalsada","Timbao","Tubigan","Zapote"],
          },
          {
            name: "Los Baños",
            zipCode: "4030",
            barangays: ["Bagong Silang","Bambang","Batong Malake","Baybayin Pob.","Bayog","Lalakay","Maahas","Malinta","Mayondon","Putho-Tuntungin","San Antonio","Tadlak","Timugan"],
          },
          {
            name: "San Pablo City",
            zipCode: "4000",
            barangays: ["Bagong Buhay I","Bagong Buhay II","Bagong Buhay III","Dolores","San Antonio 1","San Antonio 2","San Bartolome","San Buenaventura Pob.","San Crispin","San Cristobal","San Diego","San Francisco","San Gabriel I","San Gabriel II","San Gregorio","San Ignacio","San Isidro","San Jose","San Juan","San Lucas I","San Lucas II","San Marcos","San Mateo","San Miguel","San Pedro","San Roque","San Simon","Santa Catalina Pob.","Santa Cruz","Santa Elena","Santa Filomena Pob.","Santa Lucia","Santa Maria","Santiago I","Santiago II","Santo Angel Central","Santo Cristo Pob.","Santo Niño","Soledad"],
          },
        ],
      },
      {
        name: "Rizal",
        cities: [
          {
            name: "Antipolo City",
            zipCode: "1870",
            barangays: ["Bagong Nayon","Beverly Hills","Calawis","Cupang","Dalig","Del Mundo","Dela Paz Proper","Dela Paz Bonus","Inarawan","Mambugan","Mayamot","Muntingdilaw","San Isidro","San Jose Pob.","San Juan Pob.","San Luis","San Roque","Santa Cruz"],
          },
          {
            name: "Cainta",
            zipCode: "1900",
            barangays: ["Batingan","Brgy. A Pob.","Brgy. B Pob.","Brgy. C Pob.","Brgy. D Pob.","Brgy. E Pob.","Brgy. F Pob.","Dela Paz","San Andres","San Isidro Pob.","Santa Rosa","Santo Tomas","Silangan","Sto. Domingo"],
          },
          {
            name: "Taytay",
            zipCode: "1920",
            barangays: ["Dolores","Muzon","San Isidro","San Juan","Santa Ana"],
          },
          {
            name: "Angono",
            zipCode: "1930",
            barangays: ["Bagumbayan","Kalayaan","Mahabang Lupa","Mambog","Pag-asa","San Isidro","San Pedro","San Roque","Santo Niño","Sto. Niño Kubol"],
          },
          {
            name: "Binangonan",
            zipCode: "1940",
            barangays: ["Bilis","Binangonan Poblacion","Buhangin","Calumpang","Habagatan","Janosa","Layunan","Libid","Libis","Limbon","Lunsad","Macamot","Mambog","Pantok","Pila Pila","Sabang","San Carlos","San Miguel","Sapang Baho","Tagpos","Tatala","Tayuman"],
          },
        ],
      },
      {
        name: "Batangas",
        cities: [
          {
            name: "Batangas City",
            zipCode: "4200",
            barangays: ["Alangilan","Balagtas","Balete","Banaba Centro","Banaba East","Banaba Silangan","Banaba West","Bilogo","Bolbok","Bukal","Calicanto","Catandala","Concepcion","Cuta","Dalig","Dela Paz","Dela Paz Proper","Dela Paz Pulot","Edang","Gulod Itaas","Gulod Labac","Haligue Kanluran","Haligue Silangan","Ilihan","Kumintang Ibaba","Kumintang Ilaya","Libjo","Liponpon","Maapas","Mahabang Dahilig","Mahabang Parang","Mahacot Kanluran","Mahacot Silangan","Malalim","Malibayo","Malitam","Maruclap","Mataas na Lupa","Matoco","Mauraro","Muzon","Palatasan","Pinamucan Ibaba","Pinamucan Proper","Pinamucan Silangan","Sampaga","San Agapito","San Agustin Kanluran","San Agustin Silangan","San Andres","San Antonio","San Isidro","San Jose Sico","San Miguel","San Pedro","Santa Clara","Santa Rita Aplaya","Santa Rita Karsada","Santo Domingo","Santo Niño","Santo Tomas","Simlong","Sirang Lupa","Sorosoro Ibaba","Sorosoro Ilaya","Sorosoro Karsada","Tabag","Talahib Pandayan","Talahib Payapa","Talumpok Kanluran","Talumpok Silangan","Tingga Itaas","Tingga Labac","Tubig Espesyal","Tubig Ilaya","Wawa"],
          },
          {
            name: "Lipa City",
            zipCode: "4217",
            barangays: ["Anilao","Anilao East","Antipolo del Norte","Antipolo del Sur","Bagong Pook","Balintawak","Banaybanay","Bolbok","Bulaklak","Bulacnin","Bulaon","Calingatan","Cumba","Dagatan","Duhatan","Dormitory","Embodugo","Guinhawa","Inosloban","Kayumanggi","Latag","Libjo","Lipa City Proper","Lodlod","Lumbang","Mabini","Malagonlong","Malitlit","Marauoy","Mataas na Lupa","Munting Pulo","Pagolingin Bata","Pagolingin East","Pagolingin West","Pangao","Pinagkawitan","Pinagtongulan","Plaridel","Poblacion Barangay 1","Poblacion Barangay 2","Poblacion Barangay 3","Poblacion Barangay 4","Poblacion Barangay 5","Poblacion Barangay 6","Poblacion Barangay 7","Poblacion Barangay 8","Poblacion Barangay 9","Poblacion Barangay 10","Poblacion Barangay 11","Poblacion Barangay 12","Poblacion Barangay Banahaw","Sico","Tangob","Tanguay","Tibig","Tipacan"],
          },
          {
            name: "Tanauan City",
            zipCode: "4232",
            barangays: ["Altura Bata","Altura Matanda","Altura South","Ambulong","Bagbag","Bagumbayan","Balele","Banjo East","Banjo West","Bilog-Bilog","Boot","Cale","Darasa","Dita","Divorce","Galamay-Amo","Gonzales","Hidalgo","Janopol","Janopol Oriental","Laurel","Locloc","Lunas","Luntal","Mahabang Pulo","Malaking Pulo","Mataas na Bayan","Natatas","Pagaspas","Pantay Matanda","Pantay Bata","Pinagtung-Ulan","Sala","Sambat","San Jose","Wakas North","Wakas South","Wawa"],
          },
        ],
      },
      {
        name: "Quezon",
        cities: [
          {
            name: "Lucena City",
            zipCode: "4301",
            barangays: ["Barangay I","Barangay II","Barangay III","Barangay IV","Barangay V","Barangay VI","Barangay VII","Barangay VIII","Barangay IX","Barangay X","Barra","Bocohan","Cotta","Dalahican","Domoit","Gulang-Gulang","Ibabang Dupay","Ibabang Iyam","Ibabang Talim","Ilayang Dupay","Ilayang Iyam","Ilayang Talim","Isabang","Market Area","Mayao Castillo","Mayao Crossing","Mayao Kanluran","Mayao Parada","Ransohan","Salinas","Talao-Talao"],
          },
        ],
      },
    ],
  },
  {
    name: "Region I – Ilocos Region",
    provinces: [
      {
        name: "Ilocos Norte",
        cities: [
          {
            name: "Laoag City",
            zipCode: "2900",
            barangays: ["Barangay 1","Barangay 2","Barangay 3","Barangay 4","Barangay 5","Barangay 6","Barangay 7","Barangay 8","Barangay 9","Barangay 10","Barangay 11","Barangay 12","Barangay 13","Barangay 14","Barangay 15","Barangay 16","Barangay 17","Barangay 18","Barangay 19","Barangay 20","Barangay 21","Barangay 22","Barangay 23","Barangay 24","Barangay 25","Barangay 26","Barangay 27","Barangay 28","Barangay 29","Barangay 30","Barangay 31","Barangay 32","Barangay 33","Barangay 34","Barangay 35","Barangay 36","Barangay 37","Barangay 38","Barangay 39","Barangay 40","Barangay 41","Barangay 42"],
          },
        ],
      },
      {
        name: "Ilocos Sur",
        cities: [
          {
            name: "Vigan City",
            zipCode: "2700",
            barangays: ["Ayusan Norte","Ayusan Sur","Barangay I","Barangay II","Barangay III","Barangay IV","Barangay V","Barangay VI","Barangay VII","Barangay VIII","Barangay IX","Bisbalang","Bongtolan","Bulala","Cabalangegan","Cabaroan Daya","Cabaroan Laud","Camangaan","Capangpangan","Mindoro","Nagtublayan","Pantay Daya","Pantay Fatima","Pantay Laud","Paoa","Paratong","Pong-ol","Purok-a-barroc","Raois","Rugsuanan","Salindeg","San José","San Pedro","Tamag"],
          },
        ],
      },
      {
        name: "La Union",
        cities: [
          {
            name: "San Fernando City",
            zipCode: "2500",
            barangays: ["Abut","Apaleng","Bacsil","Bangcusay","Barangay I","Barangay II","Barangay III","Barangay IV","Barangay V","Barangay VI","Barangay VII","Barangay VIII","Biday","Bisal","Cabaroan","Cadaclan","Camansi","Canaoay","Carlatan","Catbangen","Dallangayan Este","Dallangayan Oeste","Mameltac","Masicong","Pagdalagan Sur","Pagdaraoan","Pagudpud","Parian Este","Parian Oeste","Pias","Poblacion","Poro","Puspus","Sacyud","Sagayad","San Agustin","San Francisco","Sangcaba","Sevilla","Siboan-Otong","Tanqui","Tarangotong"],
          },
        ],
      },
      {
        name: "Pangasinan",
        cities: [
          {
            name: "Dagupan City",
            zipCode: "2400",
            barangays: ["Bacayao Norte","Bacayao Sur","Barangay I","Barangay II","Barangay VI-A","Bolosan","Bonuan Binloc","Bonuan Boquig","Bonuan Gueset","Calmay","Carael","Caranglaan","Herrero","Lasip Chico","Lasip Grande","Lomboy","Lucao","Malued","Mamalingling","Mangin","Mayombo","Pantal","Poblacion Oeste","Pogo Chico","Pogo Grande","Pugaro Suit","Salapingao","Salisay","Tambac","Tapuac","Tebeng"],
          },
          {
            name: "San Carlos City",
            zipCode: "2420",
            barangays: ["Abanon","Aguilar","Anando","Aypa","Balincaguing","Balococ","Baluyot","Bugallon Avenue","Bued","Burgos","Buyambayam","Cayanga","Colongan","Coloran","Doyong","Guelew","Ingalagala","Laoac","Magtaking","Malabago","Mancup","Nalsian Norte","Nalsian Sur","Pag-asa","Pagal","Papallasen","Payar","Payocpoc Norte Este","Payocpoc Norte Oeste","Payocpoc Sur","Perez","Poblacion I","Poblacion II","Poblacion III","Poblacion IV","Polo","Quezon","Quintong","San Juan","San Pedro","San Roque","San Vicente","Santo Domingo","Taloy","Telbang","Vacante"],
          },
        ],
      },
    ],
  },
  {
    name: "Region V – Bicol Region",
    provinces: [
      {
        name: "Albay",
        cities: [
          {
            name: "Legazpi City",
            zipCode: "4500",
            barangays: ["Arimbay","Bagumbayan","Banquerohan","Bariis","Bigaa","Binanohan","Bonga","Bogtong","Bonot","Buragwis","Buso","Buyuan","Cagbacong","Camatchile","Rawis","Gogon","Homapon","Imalnod","Kauswagan","Maipon","Maoyod","Matanog","Padang","Pawa","Pinaric","Sagpon","Saguin","San Joaquin","San Roque","Sanatorium","Santo Domingo","Tagas","Taysan","Tinago"],
          },
        ],
      },
      {
        name: "Camarines Sur",
        cities: [
          {
            name: "Naga City",
            zipCode: "4400",
            barangays: ["Abella","Bagumbayan Norte","Bagumbayan Sur","Balatas","Calauag","Cararayan","Carolina","Concepcion Pequeña","Dayangdang","Del Rosario","Dinaga","Fundado","Gamot","Kaantabay","Kabulusan","Lagmay","Lerma","Liboton","Mabolo","Pacol","Panicuason","Peñafrancia","Sabang","San Felipe","San Francisco","Santa Cruz","Tabuco","Tinago","Triangulo"],
          },
        ],
      },
    ],
  },
  {
    name: "Region VII – Central Visayas",
    provinces: [
      {
        name: "Cebu",
        cities: [
          {
            name: "Cebu City",
            zipCode: "6000",
            barangays: ["Adlaon","Agsungot","Apas","Babag","Bacayan","Banilad","Basak Pardo","Basak San Nicolas","Binaliw","Bonbon","Budla-an","Buhisan","Bulacao","Buot-Taup Pardo","Busay","Calamba","Cambinocot","Capitol Site","Carreta","Central","Cogon Pardo","Cogon Ramos","Day-as","Duljo","Ermita","Guadalupe","Guba","Hippodromo","Inayawan","Kalubihan","Kalunasan","Kamagayan","Kasambagan","Kinasang-an Pardo","Labangon","Lahug","Lorega San Miguel","Lusaran","Luz","Mabini","Mabolo","Malubog","Mambaling","Pahina Central","Pahina San Nicolas","Pamutan","Pardo","Pari-an","Paril","Pasil","Pit-os","Poblacion Pardo","Pulangbato","Pung-ol-Sibugay","Punta Princesa","Quiot Pardo","Sambag I","Sambag II","San Antonio","San Jose","San Nicolas Central","San Nicolas Proper","San Roque","Santa Cruz","Santo Niño","Sapangdaku","Sawang Calero","Sinsin","Sirao","Suba Pasil","Sudlon I","Sudlon II","T. Padilla","Tabunan","Tagbao","Talamban","Taptap","Tejero","Tinago","Tisa","To-ong Pardo","Tugbungan","Tungkop","Tuyan","Umapad","Valencia"],
          },
          {
            name: "Lapu-Lapu City",
            zipCode: "6015",
            barangays: ["Agus","Babag","Bankal","Baring","Basak","Buagsong","Calawisan","Canjulao","Caubian","Caw-oy","Cawhagan","Gun-ob","Ibo","Looc","Mactan","Maribago","Marigondon","Pajac","Pajo","Pangan-an","Poblacion","Punta Engaño","Pusok","Sabang","San Vicente","Santa Rosa","Subabasbas","Talima","Tingo","Tungasan"],
          },
          {
            name: "Mandaue City",
            zipCode: "6014",
            barangays: ["Alang-Alang","Bakilid","Banilad","Basak","Cambaro","Canduman","Casili","Casuntingan","Centro","Cubacub","Guizo","Ibabao-Estancia","Jagobiao","Labogon","Looc","Maguikay","Mantuyong","Opao","Pakna-an","Paknaan","Pagsabungan","Subangdaku","Tabok","Tawason","Tingub","Tipolo","Umapad"],
          },
        ],
      },
    ],
  },
  {
    name: "Region XI – Davao Region",
    provinces: [
      {
        name: "Davao del Sur",
        cities: [
          {
            name: "Davao City",
            zipCode: "8000",
            barangays: ["Acacia","Agdao","Alambre","Alejandra Navarro","Alfonso Angliongto Sr.","Angalan","Atan-Awe","Baganihan","Bajada","Baliok","Bangkas Heights","Bantol","Barrio Luz","Biao Escuela","Biao Guianga","Biao Joaquin","Binugao","Bucana","Buda","Buhangin Proper","Bunawan Proper","Cabantian","Cadalian","Calinan Proper","Callawa","Camansi","Carmen","Catalunan Grande","Catalunan Pequeño","Catigan","Cawayan","Centro (San Juan)","Colosas","Communal","Crossing Bayabas","Dacudao","Dalag","Dalagdag","Daliao","Daliaon Plantation","Datu Salumay","Dominga","Dumoy","Eden","Fatima (Benowang)","Gatungan","Gov. Paciano Bangoy","Gov. Vicente Duterte","Gumalang","Gumitan","Ilang","Inayangan","Indangan","Kap. Tomas Monteverde, Sr.","Kilate","Lacson","Lamanan","Lampianao","Langub","Lapu-lapu","Leon Garcia, Sr.","Lizada","Los Amigos","Lubogan","Lumiad","Ma-a","Mabuhay","Magsaysay","Magtuod","Mahayag","Malabog","Malagos","Malamba","Manambulan","Mandug","Manuel Guianga","Mapula","Marapangi","Mario Guianga","Marisol","Matina Aplaya","Matina Crossing","Matina Pangi","Megkawayan","Mintal","Mudiang","Mulig","New Carmen","New Valencia","Pampanga","Panacan","Panalanoy","Pangyan","Paquibato Proper","Paradise Embak","Rafael Castillo","Riverside","Salapawan","Salaysay","Saloy","San Antonio","San Isidro","Santo Niño","Sasa","Sirib","Sirawan","Sibulan","Subasta","Tacunan","Tagurano","Talandang","Talomo Proper","Talomo River","Tamayong","Tambobong","Tamugan","Tapak","Tawan-Tawan","Tibuloy","Tibungco","Tigatto","Toril Proper","Tugbok Proper","Tungkalan","Uwillem","Unitad","Uyanguren","Vilo","Waan","Wangan","Wilfredo Aquino","Wines"],
          },
        ],
      },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getRegions(): string[] {
  return PH_REGIONS.map((r) => r.name)
}

export function getProvinces(region: string): PHProvince[] {
  return PH_REGIONS.find((r) => r.name === region)?.provinces ?? []
}

export function getCities(region: string, province: string): PHCity[] {
  return getProvinces(region).find((p) => p.name === province)?.cities ?? []
}

export function getBarangays(region: string, province: string, city: string): string[] {
  return getCities(region, province).find((c) => c.name === city)?.barangays ?? []
}

export function getZipCode(region: string, province: string, city: string): string {
  return getCities(region, province).find((c) => c.name === city)?.zipCode ?? ""
}
