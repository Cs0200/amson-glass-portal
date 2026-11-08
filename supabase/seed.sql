insert into public.services(id,name,tag,rate,description,image,sort_order) values
('partitions','Glass partitions','Spaces that flow',650,'Create quiet, light-filled spaces with precision-fitted glass partitions.','/images/glass-interior.png',0),
('railings','Glass railings','An uninterrupted view',900,'Clean-lined glass balustrades for staircases, balconies, and terraces.','/images/glass-railings.png',1),
('showers','Shower cubicles','Your everyday retreat',850,'Made-to-measure shower enclosures with considered hardware and seals.','/images/shower-cubicle.png',2),
('doors','Glass doors','Make an entrance',750,'Elegant hinged and sliding doors, tailored to the way you use your space.','/images/glass-doors.png',3),
('mirrors','Custom mirrors','A new perspective',350,'Custom sizes, polished edges, and thoughtful placement for every room.','/images/custom-mirrors.png',4),
('films','Glass film','Light, on your terms',120,'Privacy, frosted decorative, and solar-control films for existing glass in homes, offices, and shopfronts.','/images/glass-film-installation.png',5)
on conflict(id) do nothing;
