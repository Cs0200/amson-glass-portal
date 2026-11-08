export const services = [
{id:'partitions',name:'Glass partitions',tag:'Spaces that flow',rate:650,description:'Create quiet, light-filled spaces with precision-fitted glass partitions.',image:'/images/glass-interior.png'},
{id:'railings',name:'Glass railings',tag:'An uninterrupted view',rate:900,description:'Clean-lined glass balustrades for staircases, balconies, and terraces.',image:'/images/glass-railings.png'},
{id:'showers',name:'Shower cubicles',tag:'Your everyday retreat',rate:850,description:'Made-to-measure shower enclosures with considered hardware and seals.',image:'/images/shower-cubicle.png'},
{id:'doors',name:'Glass doors',tag:'Make an entrance',rate:750,description:'Elegant hinged and sliding doors, tailored to the way you use your space.',image:'/images/glass-doors.png'},
{id:'mirrors',name:'Custom mirrors',tag:'A new perspective',rate:350,description:'Custom sizes, polished edges, and thoughtful placement for every room.',image:'/images/custom-mirrors.png'},
{id:'films',name:'Glass film',tag:'Light, on your terms',rate:120,description:'Privacy, frosted decorative, and solar-control films for existing glass in homes, offices, and shopfronts.',image:'/images/glass-film-installation.png'}];
export const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
export const stages=['New','Contacted','Quoted','Approved','Installed','Completed'];
