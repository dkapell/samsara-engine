create type function_type as ENUM(
    'conditional',
    'action',
    'ink'
);

create table functions(
    id serial,
    game_id int not null,
    name varchar(80) not null,
    usage varchar(255),
    type function_type not null,
    description text,
    content text,
    primary key (id),
    unique(game_id, name),
    CONSTRAINT functions_game_fk FOREIGN KEY (game_id)
        REFERENCES "games" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);
