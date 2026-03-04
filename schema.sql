-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.User (
  userid integer NOT NULL DEFAULT nextval('"User_userid_seq"'::regclass),
  fname character varying NOT NULL,
  lname character varying,
  phone character varying,
  passwordhash character varying NOT NULL,
  zoneid integer,
  familyowner integer,
  wishtovolunteer boolean DEFAULT false,
  level integer DEFAULT 1 CHECK (level >= 1 AND level <= 10),
  registrationdate timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  aadharno character varying,
  CONSTRAINT User_pkey PRIMARY KEY (userid),
  CONSTRAINT User_zoneid_fkey FOREIGN KEY (zoneid) REFERENCES public.zone(zoneid),
  CONSTRAINT User_familyowner_fkey FOREIGN KEY (familyowner) REFERENCES public.family(createdby)
);
CREATE TABLE public.authority (
  badgenumber integer NOT NULL DEFAULT nextval('authority_badgenumber_seq'::regclass),
  branchid integer,
  fname character varying NOT NULL,
  lname character varying NOT NULL,
  rank character varying,
  contactnumber character varying,
  email character varying,
  availabilitystatus USER-DEFINED,
  passwordhash character varying NOT NULL,
  CONSTRAINT authority_pkey PRIMARY KEY (badgenumber),
  CONSTRAINT authority_branchid_fkey FOREIGN KEY (branchid) REFERENCES public.deptbranch(branchid)
);
CREATE TABLE public.authorityassignment (
  requestid integer NOT NULL,
  authorityid integer NOT NULL,
  assignedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  status USER-DEFINED,
  notes text,
  completedat timestamp without time zone,
  CONSTRAINT authorityassignment_pkey PRIMARY KEY (requestid, authorityid),
  CONSTRAINT authorityassignment_requestid_fkey FOREIGN KEY (requestid) REFERENCES public.request(requestid),
  CONSTRAINT authorityassignment_authorityid_fkey FOREIGN KEY (authorityid) REFERENCES public.authority(badgenumber)
);
CREATE TABLE public.crisistype (
  crisistypeid integer NOT NULL DEFAULT nextval('crisistype_crisistypeid_seq'::regclass),
  typename character varying NOT NULL,
  defaultseverity integer NOT NULL CHECK (defaultseverity >= 1 AND defaultseverity <= 10),
  defaultdescription text,
  CONSTRAINT crisistype_pkey PRIMARY KEY (crisistypeid)
);
CREATE TABLE public.department (
  deptid integer NOT NULL DEFAULT nextval('department_deptid_seq'::regclass),
  deptname character varying NOT NULL,
  description text,
  contactnumber character varying,
  email character varying,
  hq integer,
  depthead integer,
  CONSTRAINT department_pkey PRIMARY KEY (deptid),
  CONSTRAINT fk_hq FOREIGN KEY (hq) REFERENCES public.deptbranch(branchid),
  CONSTRAINT fk_dept_head FOREIGN KEY (depthead) REFERENCES public.authority(badgenumber)
);
CREATE TABLE public.deptbranch (
  branchid integer NOT NULL DEFAULT nextval('deptbranch_branchid_seq'::regclass),
  deptid integer,
  zoneid integer,
  branchname character varying NOT NULL,
  contactnumber character varying,
  email character varying,
  branchhead integer,
  CONSTRAINT deptbranch_pkey PRIMARY KEY (branchid),
  CONSTRAINT deptbranch_deptid_fkey FOREIGN KEY (deptid) REFERENCES public.department(deptid),
  CONSTRAINT deptbranch_zoneid_fkey FOREIGN KEY (zoneid) REFERENCES public.zone(zoneid),
  CONSTRAINT fk_branch_head FOREIGN KEY (branchhead) REFERENCES public.authority(badgenumber)
);
CREATE TABLE public.depthandlecrisistype (
  deptid integer NOT NULL,
  crisistypeid integer NOT NULL,
  CONSTRAINT depthandlecrisistype_pkey PRIMARY KEY (deptid, crisistypeid),
  CONSTRAINT depthandlecrisistype_deptid_fkey FOREIGN KEY (deptid) REFERENCES public.department(deptid),
  CONSTRAINT depthandlecrisistype_crisistypeid_fkey FOREIGN KEY (crisistypeid) REFERENCES public.crisistype(crisistypeid)
);
CREATE TABLE public.family (
  createdby integer NOT NULL,
  familyname character varying NOT NULL,
  cumulativelevel integer DEFAULT 0,
  nummembers integer CHECK (nummembers <= 6),
  createdat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT family_pkey PRIMARY KEY (createdby),
  CONSTRAINT fk_family_createdby FOREIGN KEY (createdby) REFERENCES public.User(userid)
);
CREATE TABLE public.request (
  requestid integer NOT NULL DEFAULT nextval('request_requestid_seq'::regclass),
  crisistypeid integer,
  createdby integer,
  zoneid integer,
  title character varying NOT NULL,
  description text,
  severity integer NOT NULL CHECK (severity >= 1 AND severity <= 10),
  status USER-DEFINED DEFAULT 'Open'::request_status,
  numvolunteerneeded integer,
  startdatetime timestamp without time zone,
  enddatetime timestamp without time zone,
  CONSTRAINT request_pkey PRIMARY KEY (requestid),
  CONSTRAINT request_crisistypeid_fkey FOREIGN KEY (crisistypeid) REFERENCES public.crisistype(crisistypeid),
  CONSTRAINT request_createdby_fkey FOREIGN KEY (createdby) REFERENCES public.User(userid),
  CONSTRAINT request_zoneid_fkey FOREIGN KEY (zoneid) REFERENCES public.zone(zoneid)
);
CREATE TABLE public.userhelp (
  requestid integer NOT NULL,
  userid integer NOT NULL,
  joinedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  completedat timestamp without time zone,
  status USER-DEFINED,
  CONSTRAINT userhelp_pkey PRIMARY KEY (requestid, userid),
  CONSTRAINT userhelp_requestid_fkey FOREIGN KEY (requestid) REFERENCES public.request(requestid),
  CONSTRAINT userhelp_userid_fkey FOREIGN KEY (userid) REFERENCES public.User(userid)
);
CREATE TABLE public.zone (
  zoneid integer NOT NULL DEFAULT nextval('zone_zoneid_seq'::regclass),
  zonename character varying NOT NULL,
  location character varying,
  state character varying,
  numresidents integer,
  risklevel integer NOT NULL CHECK (risklevel >= 1 AND risklevel <= 5),
  CONSTRAINT zone_pkey PRIMARY KEY (zoneid)
);

-- ============================================================
-- RUN THESE IN THE SUPABASE SQL EDITOR
-- ============================================================

-- 0. Clean up ALL dependent data from previous runs (safe to re-run)
--    Order matters: break circular FKs first, then delete leaf→root

-- 0a. Null out circular / cross-table FK columns
UPDATE public.department  SET depthead = NULL, hq = NULL;
UPDATE public.deptbranch  SET branchhead = NULL;

-- 0b. Delete tables that reference request (must go before request)
DELETE FROM public.userhelp;
DELETE FROM public.authorityassignment;

-- 0c. Delete requests (references crisistype, zone, User)
DELETE FROM public.request;

-- 0d. Delete mapping / junction tables
DELETE FROM public.depthandlecrisistype;

-- 0e. Delete authority (references deptbranch, department)
DELETE FROM public.authority;

-- 0f. Delete deptbranch (references department, zone)
DELETE FROM public.deptbranch;

-- 0g. Delete department
DELETE FROM public.department;

-- 0h. Delete crisistype (now safe — no request rows reference it)
DELETE FROM public.crisistype;

-- 0i. Null out User zone refs so we can delete zones
UPDATE public."User" SET zoneid = NULL WHERE zoneid IN (
  SELECT zoneid FROM public.zone WHERE zonename IN (
    'North District','South District','East District','West District',
    'Central District','Coastal Zone','Hillside Zone','Riverside Zone'
  )
);

-- 0j. Delete seeded zones
DELETE FROM public.zone WHERE zonename IN (
  'North District','South District','East District','West District',
  'Central District','Coastal Zone','Hillside Zone','Riverside Zone'
);

-- 1. Add deptid column to authority table with FK to department
--    (Will error if already added — that's OK, skip this step if so)
ALTER TABLE public.authority
  ADD COLUMN IF NOT EXISTS deptid integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'authority_deptid_fkey'
  ) THEN
    ALTER TABLE public.authority
      ADD CONSTRAINT authority_deptid_fkey
      FOREIGN KEY (deptid) REFERENCES public.department(deptid);
  END IF;
END $$;

-- ============================================================
-- 2. Populate zone table
-- ============================================================
INSERT INTO public.zone (zonename, location, state, numresidents, risklevel) VALUES
  ('North District',   'North Delhi',     'Delhi',        520000, 3),
  ('South District',   'South Delhi',     'Delhi',        480000, 2),
  ('East District',    'East Delhi',      'Delhi',        390000, 4),
  ('West District',    'West Delhi',      'Delhi',        410000, 3),
  ('Central District', 'Central Delhi',   'Delhi',        350000, 5),
  ('Coastal Zone',     'Mumbai South',    'Maharashtra',  600000, 5),
  ('Hillside Zone',    'Shimla',          'Himachal Pradesh', 180000, 4),
  ('Riverside Zone',   'Varanasi',        'Uttar Pradesh', 440000, 4);

-- ============================================================
-- 3. Populate crisistype table
-- ============================================================
INSERT INTO public.crisistype (typename, defaultseverity, defaultdescription) VALUES
  ('Flood',         7, 'Water overflow affecting residential and commercial areas'),
  ('Earthquake',    9, 'Seismic activity causing structural damage'),
  ('Fire',          8, 'Uncontrolled fire in buildings or forest areas'),
  ('Cyclone',       8, 'Severe tropical storm with high-speed winds'),
  ('Landslide',     7, 'Mass movement of earth/rock on slopes'),
  ('Drought',       5, 'Prolonged shortage of water supply'),
  ('Epidemic',      6, 'Rapid spread of infectious disease in a community'),
  ('Industrial Accident', 8, 'Hazardous incident at an industrial facility'),
  ('Building Collapse',  9, 'Structural failure of a building'),
  ('Road Accident',      5, 'Major vehicular accident requiring emergency response');

-- ============================================================
-- 4. Populate department table
-- ============================================================
INSERT INTO public.department (deptname, description, contactnumber, email) VALUES
  ('Fire Department',           'Handles fire emergencies and rescue operations',         '011-1001001', 'fire@disaster.gov.in'),
  ('Flood Control',             'Manages flood prevention, drainage and relief',           '011-1002002', 'flood@disaster.gov.in'),
  ('Earthquake Response Unit',  'Structural assessment and earthquake rescue',             '011-1003003', 'earthquake@disaster.gov.in'),
  ('Medical Emergency',         'Emergency medical services and epidemic control',         '011-1004004', 'medical@disaster.gov.in'),
  ('Law Enforcement',           'Maintains law and order during disasters',                '011-1005005', 'police@disaster.gov.in'),
  ('Civil Defense',             'Coordinates overall civil defense and relief operations',  '011-1006006', 'civildefense@disaster.gov.in');

-- ============================================================
-- 5. Populate deptbranch table
-- ============================================================
INSERT INTO public.deptbranch (deptid, zoneid, branchname, contactnumber, email) VALUES
  ((SELECT deptid FROM department WHERE deptname='Fire Department' LIMIT 1),
   (SELECT zoneid FROM zone WHERE zonename='North District' LIMIT 1),
   'Fire Station North', '011-2001001', 'fire.north@disaster.gov.in'),

  ((SELECT deptid FROM department WHERE deptname='Fire Department' LIMIT 1),
   (SELECT zoneid FROM zone WHERE zonename='South District' LIMIT 1),
   'Fire Station South', '011-2001002', 'fire.south@disaster.gov.in'),

  ((SELECT deptid FROM department WHERE deptname='Flood Control' LIMIT 1),
   (SELECT zoneid FROM zone WHERE zonename='East District' LIMIT 1),
   'Flood Control East', '011-2002001', 'flood.east@disaster.gov.in'),

  ((SELECT deptid FROM department WHERE deptname='Flood Control' LIMIT 1),
   (SELECT zoneid FROM zone WHERE zonename='Coastal Zone' LIMIT 1),
   'Flood Control Coastal', '011-2002002', 'flood.coastal@disaster.gov.in'),

  ((SELECT deptid FROM department WHERE deptname='Earthquake Response Unit' LIMIT 1),
   (SELECT zoneid FROM zone WHERE zonename='Hillside Zone' LIMIT 1),
   'Earthquake Response Hillside', '011-2003001', 'eq.hillside@disaster.gov.in'),

  ((SELECT deptid FROM department WHERE deptname='Medical Emergency' LIMIT 1),
   (SELECT zoneid FROM zone WHERE zonename='Central District' LIMIT 1),
   'Medical Emergency Central', '011-2004001', 'med.central@disaster.gov.in'),

  ((SELECT deptid FROM department WHERE deptname='Law Enforcement' LIMIT 1),
   (SELECT zoneid FROM zone WHERE zonename='West District' LIMIT 1),
   'Police West', '011-2005001', 'police.west@disaster.gov.in'),

  ((SELECT deptid FROM department WHERE deptname='Civil Defense' LIMIT 1),
   (SELECT zoneid FROM zone WHERE zonename='Riverside Zone' LIMIT 1),
   'Civil Defense Riverside', '011-2006001', 'cd.riverside@disaster.gov.in');

-- ============================================================
-- 6. Populate authority table (with deptid)
-- ============================================================
INSERT INTO public.authority (branchid, deptid, fname, lname, rank, contactnumber, email, availabilitystatus, passwordhash) VALUES
  ((SELECT branchid FROM deptbranch WHERE branchname='Fire Station North' LIMIT 1),
   (SELECT deptid FROM department WHERE deptname='Fire Department' LIMIT 1),
   'Sarah',  'Connor',   'Captain',    '9800000001', 'sarah.connor@disaster.gov.in',   'AVAILABLE', 'auth123'),

  ((SELECT branchid FROM deptbranch WHERE branchname='Fire Station South' LIMIT 1),
   (SELECT deptid FROM department WHERE deptname='Fire Department' LIMIT 1),
   'James',  'Kirk',     'Lieutenant', '9800000002', 'james.kirk@disaster.gov.in',     'AVAILABLE', 'auth123'),

  ((SELECT branchid FROM deptbranch WHERE branchname='Flood Control East' LIMIT 1),
   (SELECT deptid FROM department WHERE deptname='Flood Control' LIMIT 1),
   'Ravi',   'Kumar',    'Inspector',  '9800000003', 'ravi.kumar@disaster.gov.in',     'AVAILABLE', 'auth123'),

  ((SELECT branchid FROM deptbranch WHERE branchname='Flood Control Coastal' LIMIT 1),
   (SELECT deptid FROM department WHERE deptname='Flood Control' LIMIT 1),
   'Priya',  'Sharma',   'Captain',    '9800000004', 'priya.sharma@disaster.gov.in',   'AVAILABLE', 'auth123'),

  ((SELECT branchid FROM deptbranch WHERE branchname='Earthquake Response Hillside' LIMIT 1),
   (SELECT deptid FROM department WHERE deptname='Earthquake Response Unit' LIMIT 1),
   'Arjun',  'Patel',    'Major',      '9800000005', 'arjun.patel@disaster.gov.in',    'AVAILABLE', 'auth123'),

  ((SELECT branchid FROM deptbranch WHERE branchname='Medical Emergency Central' LIMIT 1),
   (SELECT deptid FROM department WHERE deptname='Medical Emergency' LIMIT 1),
   'Meena',  'Reddy',    'Doctor',     '9800000006', 'meena.reddy@disaster.gov.in',    'AVAILABLE', 'auth123'),

  ((SELECT branchid FROM deptbranch WHERE branchname='Police West' LIMIT 1),
   (SELECT deptid FROM department WHERE deptname='Law Enforcement' LIMIT 1),
   'Vikram', 'Singh',    'Inspector',  '9800000007', 'vikram.singh@disaster.gov.in',   'AVAILABLE', 'auth123'),

  ((SELECT branchid FROM deptbranch WHERE branchname='Civil Defense Riverside' LIMIT 1),
   (SELECT deptid FROM department WHERE deptname='Civil Defense' LIMIT 1),
   'Anita',  'Desai',    'Commander',  '9800000008', 'anita.desai@disaster.gov.in',    'AVAILABLE', 'auth123');

-- ============================================================
-- 7. Populate depthandlecrisistype (which dept handles which crisis)
-- ============================================================
INSERT INTO public.depthandlecrisistype (deptid, crisistypeid) VALUES
  ((SELECT deptid FROM department WHERE deptname='Fire Department' LIMIT 1),
   (SELECT crisistypeid FROM crisistype WHERE typename='Fire' LIMIT 1)),
  ((SELECT deptid FROM department WHERE deptname='Flood Control' LIMIT 1),
   (SELECT crisistypeid FROM crisistype WHERE typename='Flood' LIMIT 1)),
  ((SELECT deptid FROM department WHERE deptname='Flood Control' LIMIT 1),
   (SELECT crisistypeid FROM crisistype WHERE typename='Cyclone' LIMIT 1)),
  ((SELECT deptid FROM department WHERE deptname='Earthquake Response Unit' LIMIT 1),
   (SELECT crisistypeid FROM crisistype WHERE typename='Earthquake' LIMIT 1)),
  ((SELECT deptid FROM department WHERE deptname='Earthquake Response Unit' LIMIT 1),
   (SELECT crisistypeid FROM crisistype WHERE typename='Landslide' LIMIT 1)),
  ((SELECT deptid FROM department WHERE deptname='Earthquake Response Unit' LIMIT 1),
   (SELECT crisistypeid FROM crisistype WHERE typename='Building Collapse' LIMIT 1)),
  ((SELECT deptid FROM department WHERE deptname='Medical Emergency' LIMIT 1),
   (SELECT crisistypeid FROM crisistype WHERE typename='Epidemic' LIMIT 1)),
  ((SELECT deptid FROM department WHERE deptname='Law Enforcement' LIMIT 1),
   (SELECT crisistypeid FROM crisistype WHERE typename='Road Accident' LIMIT 1)),
  ((SELECT deptid FROM department WHERE deptname='Civil Defense' LIMIT 1),
   (SELECT crisistypeid FROM crisistype WHERE typename='Drought' LIMIT 1)),
  ((SELECT deptid FROM department WHERE deptname='Civil Defense' LIMIT 1),
   (SELECT crisistypeid FROM crisistype WHERE typename='Industrial Accident' LIMIT 1));

-- ============================================================
-- 8. Link department heads and branch heads
-- ============================================================
UPDATE public.department SET depthead = (SELECT badgenumber FROM authority WHERE fname='Sarah' AND lname='Connor' LIMIT 1)
  WHERE deptname = 'Fire Department';
UPDATE public.department SET depthead = (SELECT badgenumber FROM authority WHERE fname='Ravi' AND lname='Kumar' LIMIT 1)
  WHERE deptname = 'Flood Control';
UPDATE public.department SET depthead = (SELECT badgenumber FROM authority WHERE fname='Arjun' AND lname='Patel' LIMIT 1)
  WHERE deptname = 'Earthquake Response Unit';
UPDATE public.department SET depthead = (SELECT badgenumber FROM authority WHERE fname='Meena' AND lname='Reddy' LIMIT 1)
  WHERE deptname = 'Medical Emergency';
UPDATE public.department SET depthead = (SELECT badgenumber FROM authority WHERE fname='Vikram' AND lname='Singh' LIMIT 1)
  WHERE deptname = 'Law Enforcement';
UPDATE public.department SET depthead = (SELECT badgenumber FROM authority WHERE fname='Anita' AND lname='Desai' LIMIT 1)
  WHERE deptname = 'Civil Defense';

UPDATE public.deptbranch SET branchhead = (SELECT badgenumber FROM authority WHERE fname='Sarah' AND lname='Connor' LIMIT 1)
  WHERE branchname = 'Fire Station North';
UPDATE public.deptbranch SET branchhead = (SELECT badgenumber FROM authority WHERE fname='James' AND lname='Kirk' LIMIT 1)
  WHERE branchname = 'Fire Station South';
UPDATE public.deptbranch SET branchhead = (SELECT badgenumber FROM authority WHERE fname='Ravi' AND lname='Kumar' LIMIT 1)
  WHERE branchname = 'Flood Control East';
UPDATE public.deptbranch SET branchhead = (SELECT badgenumber FROM authority WHERE fname='Priya' AND lname='Sharma' LIMIT 1)
  WHERE branchname = 'Flood Control Coastal';
UPDATE public.deptbranch SET branchhead = (SELECT badgenumber FROM authority WHERE fname='Arjun' AND lname='Patel' LIMIT 1)
  WHERE branchname = 'Earthquake Response Hillside';
UPDATE public.deptbranch SET branchhead = (SELECT badgenumber FROM authority WHERE fname='Meena' AND lname='Reddy' LIMIT 1)
  WHERE branchname = 'Medical Emergency Central';
UPDATE public.deptbranch SET branchhead = (SELECT badgenumber FROM authority WHERE fname='Vikram' AND lname='Singh' LIMIT 1)
  WHERE branchname = 'Police West';
UPDATE public.deptbranch SET branchhead = (SELECT badgenumber FROM authority WHERE fname='Anita' AND lname='Desai' LIMIT 1)
  WHERE branchname = 'Civil Defense Riverside';