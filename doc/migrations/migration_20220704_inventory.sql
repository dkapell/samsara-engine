create table items(
    id serial,
    game_id int not null,
    name varchar(80) not null,
    description text,
    quantity int default 1,
    inventory_image_id int,
    item_image_id int,
    primary key (id),
    unique(game_id, name),
    CONSTRAINT items_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT inventory_image_fk FOREIGN KEY (image_id)
        REFERENCES "images" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT item_image_fk FOREIGN KEY (image_id)
        REFERENCES "images" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL
);

create type image_type as ENUM(
    'screen',
    'popup',
    'inventory',
    'item'
);

alter table images add column type image_type default 'screen' not null;
update images set type = 'popup' where is_popup = true;
update images set type = 'inventory' where is_inventory = true;
alter table images drop column is_screen;
alter table images drop column is_popup;
alter table images drop column is_inventory;
