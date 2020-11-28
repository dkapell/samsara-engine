create type user_type as ENUM(
    'admin',
    'creator',
    'gm',
    'player',
    'none'
);

create table users (
    id          serial,
    name        varchar(80),
    email       varchar(100),
    google_id   varchar(500),
    intercode_id varchar(500),
    type        user_type default none,
    PRIMARY KEY (id)
);

create table links (
    id          serial,
    name        varchar(80) not null,
    code        varchar(20) unique,
    description text,
    url         varchar(255) not null,
    gm          varchar(255),
    active      boolean default true,
    primary key (id)
);

create table runs (
    id          serial,
    name        varchar(80) not null unique,
    current     boolean default false,
    primary key(id)
);

create table groups (
    id          serial,
    name        varchar(80) not null unique,
    description text
    primary key (id),
);

create table images (
    id  serial,
    name varchar(255) not null,
    description text,
    status varchar(20) default 'new' not null,
    primary key (id)
);

create table gamestates (
    id serial,
    name varchar(255) not null,
    description text,
    special     boolean default false,
    start       boolean default false,
    finish      boolean default false,
    image_id    int not null,
    map         jsonb default '[]'::jsonb,
    template    boolean default false,
    primary key (id),
    CONSTRAINT gamestate_image_fk FOREIGN KEY (image_id)
        REFERENCES "images" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL
);

insert into gamestates (name) values ('Initial');

create table gamestate_links(
    gamestate_id int not null,
    link_id int not null,
    primary key (gamestate_id, link_id),
    CONSTRAINT gsr_gamestate_fk FOREIGN KEY (gamestate_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT gsr_link_fk FOREIGN KEY (link_id)
        REFERENCES "links" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table transitions(
    id serial,
    from_state_id int not null,
    to_state_id int not null,
    group_id int,
    link_id int,
    delay int default 0,
    primary key(id),
    CONSTRAINT transitions_from_fk FOREIGN KEY (from_state_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT transitions_to_fk FOREIGN KEY (to_state_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT transitions_group_fk FOREIGN KEY (group_id)
        REFERENCES "groups" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
     CONSTRAINT transitions_link_fk FOREIGN KEY (link_id)
        REFERENCES "links" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table players (
    id          serial,
    user_id     int,
    run_id      int,
    character   varchar(255),
    gamestate_id int,
    prev_gamestate_id int,
    statetime timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT players_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT players_run_fk FOREIGN KEY (run_id)
        REFERENCES "runs" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT players_gamestate_fk FOREIGN KEY (gamestate_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT players_prev_gamestate_fk FOREIGN KEY (prev_gamestate_id)
        REFERENCES "gamestates" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
);

create table player_groups(
    player_id int not null,
    group_id int not null,
    CONSTRAINT player_fk FOREIGN KEY (player_id)
        REFERENCES "players" (id) match simple
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT group_fk FOREIGN KEY (group_id)
        REFERENCES "groups" (id) match simple
        ON UPDATE NO ACTION ON DELETE SET NULL
)

