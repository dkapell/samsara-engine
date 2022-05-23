alter table variables add column ink_name varchar(255);

create table inks(
    id serial,
    name varchar(80) not null,
    description text,
    content text,
    compiled json,
    primary key (id)
);

create table ink_states(
    id serial,
    player_id int not null,
    ink_id int not null,
    state json not null,
    complete boolean default false,
    updated timestamp with time zone default now(),
    primary key (id),
    CONSTRAINT player_fk FOREIGN KEY (player_id)
        REFERENCES "players" (id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT ink_fk FOREIGN KEY (ink_id)
        REFERENCES "inks" (id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE
)
