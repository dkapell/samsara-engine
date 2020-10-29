create table users (
    id          serial,
    name        varchar(80),
    email       varchar(100),
    google_id  varchar(500),
    is_admin   boolean default false,
    is_gm boolean default false,
    is_player boolean default false,
    PRIMARY KEY (id)
);

create table rooms (
    id          serial,
    name        varchar(80) not null,
    code        varchar(20) not null unique,
    description text,
    url         varchar(255) not null,
    gm          varchar(255),
    active      boolean default true,
    primary key (id)
);
