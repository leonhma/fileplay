create table users (
  uid int generated by default as identity not null,
  display_name text not null,
  avatar_seed text not null,
  created_at int not null default extract(epoch from now()),
  primary key (uid)
);
create table devices (
  did int generated by default as identity not null,
  display_name text not null,
  type text not null,
  uid int,
  linked_at int,
  created_at int not null default extract(epoch from now()),
  push_subscription text,
  primary key (did),
  foreign key (uid) references users (uid) on delete cascade
);
create table devices_link_codes (
  code text not null,
  uid int not null,
  created_did int not null,
  expires int not null,
  primary key (code),
  foreign key (uid) references users (uid) on delete cascade
);
create table contacts_link_codes (
  code text not null,
  uid int not null,
  created_did int not null,
  expires int not null,
  primary key (code),
  foreign key (uid) references users (uid) on delete cascade
);
create index idx_devices_uid on devices(uid);
create table contacts (
  cid int generated by default as identity not null,
  a int not null,
  b int not null,
  created_at int not null default extract(epoch from now()),
  primary key (cid),
  foreign key (a) references users (uid) on delete cascade,
  foreign key (b) references users (uid) on delete cascade
);
create index idx_contacts_a on contacts(a);
create index idx_contacts_b on contacts(b);