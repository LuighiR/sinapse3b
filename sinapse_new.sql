--- ENUMS NECESSÁRIOS BACK END ---
CREATE TYPE public."SessionType" AS ENUM (
	'CLOSED',
	'OPEN_REAL',
	'OPEN_WEAK',
	'UNTRACKED');

CREATE TYPE public."MessageSenderType" AS ENUM (
	'HUMAN',
	'SYSTEM',
	'AI');

--- TABELAS DO FRONT END ---
CREATE TABLE public."Tenant" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"isActive" bool DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"apiBaseUrl" text DEFAULT ''::text NOT NULL,
	"apiKey" text DEFAULT ''::text NOT NULL,
	"backendClientId" text NULL,
	"backendLastError" text NULL,
	"backendLastSyncAt" timestamp(3) NULL,
	"backendSyncStatus" text DEFAULT 'PENDING'::text NOT NULL,
	CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree ("slug");

CREATE TABLE public."User" (
	"id" text NOT NULL,
	"name" text NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"isSuperAdmin" bool DEFAULT false NOT NULL,
	"isActive" bool DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree ("email");

CREATE TABLE public."Membership" (
	"id" text NOT NULL,
	"tenantId" text NOT NULL,
	"userId" text NOT NULL,
	"role" public."Role" NOT NULL,
	"isActive" bool DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "Membership_pkey" PRIMARY KEY ("id"),
	CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON public."Membership" USING btree ("tenantId", "userId");


--- TABELAS BACKEND ---
CREATE TABLE public.sinapse_clients (
	"id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
    "domainUuid" text NOT NULL,
	"apiBaseUrl" text NOT NULL,
	"apiKey" text NOT NULL,
	"isActive" bool DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT sinapse_clients_pkey PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX sinapse_clients_slug_key ON public.sinapse_clients USING btree ("slug");

CREATE TABLE public.branches (
    "id" SERIAL,
    "name" text NOT NULL,
    "address" text NOT NULL,
    "phone" text NOT NULL,
    "cnpj" text NOT NULL,
    "clientId" text NOT NULL,
    "erpId" int8 NOT NULL,
    CONSTRAINT branches_pkey PRIMARY KEY ("id"),
    CONSTRAINT "branches_client_id_fkey" FOREIGN KEY ("clientId") REFERENCES public.sinapse_clients("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE public.employees (
    "id" SERIAL,
    "name" text NOT NULL,
    "extensionNumber" text NOT NULL,
    "extensionUuid" text NOT NULL,
    "erpId" int8 NOT NULL,
    "chatId" text NOT NULL,
    CONSTRAINT employees_pkey PRIMARY KEY ("id")
);

CREATE TABLE public.contacts (
	"id" int8 NOT NULL,
	"clientId" text NOT NULL,
	"companyId" int8 NULL,
	"name" text NULL,
	"number" text NULL,
	"email" text NULL,
	"isGroup" bool NOT NULL,
	"socialConnectionId" int8 NULL,
	"profilePicUrl" text NULL,
	"createdAtRemote" timestamp(3) NULL,
	"updatedAtRemote" timestamp(3) NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT contacts_pkey PRIMARY KEY ("clientId", "id")
);
CREATE INDEX "contacts_clientId_number_idx" ON public.contacts USING btree ("clientId", number);

CREATE TABLE public.tags (
	"id" int8 NOT NULL,
	"clientId" text NOT NULL,
	"companyId" int8 NULL,
	"name" text NOT NULL,
	"color" text NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT tags_pkey PRIMARY KEY ("clientId", "id")
);
CREATE INDEX "tags_clientId_name_idx" ON public.tags USING btree ("clientId", "name");

CREATE TABLE public.contact_tags (
	"clientId" text NOT NULL,
	"contactId" int8 NOT NULL,
	"tagId" int8 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT contact_tags_pkey PRIMARY KEY ("clientId", "contactId", "tagId"),
	CONSTRAINT "contact_tags_clientId_contactId_fkey" FOREIGN KEY ("clientId","contactId") REFERENCES public.contacts("clientId","id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "contact_tags_clientId_tagId_fkey" FOREIGN KEY ("clientId","tagId") REFERENCES public.tags("clientId","id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "contact_tags_clientId_tagId_idx" ON public.contact_tags USING btree ("clientId", "tagId");

CREATE TABLE public.tickets (
	"id" text NOT NULL,
	"externalUuid" text NOT NULL,
	"externalTicketId" int4 NULL,
	status text NULL,
	"contactName" text NULL,
	"contactNumber" text NULL,
	"contactExternalId" int4 NULL,
	"socialConnectionId" int4 NULL,
	"companyId" int4 NULL,
	"createdAtExternal" timestamp(3) NULL,
	"updatedAtExternal" timestamp(3) NULL,
	"lastImportedMessageCreatedAt" timestamp(3) NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"clientId" text NOT NULL,
	"contactId" int8 NULL,
	"isGroup" bool DEFAULT false NOT NULL,
	CONSTRAINT tickets_pkey PRIMARY KEY ("id"),
	CONSTRAINT "tickets_clientId_contactId_fkey" FOREIGN KEY ("clientId","contactId") REFERENCES public.contacts("clientId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
	CONSTRAINT "tickets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public.sinapse_clients("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "tickets_clientId_contactId_idx" ON public.tickets USING btree ("clientId", "contactId");
CREATE UNIQUE INDEX "tickets_clientId_externalUuid_key" ON public.tickets USING btree ("clientId", "externalUuid");
CREATE INDEX "tickets_clientId_isGroup_idx" ON public.tickets USING btree ("clientId", "isGroup");
CREATE INDEX "tickets_clientId_updatedAtExternal_idx" ON public.tickets USING btree ("clientId", "updatedAtExternal");

CREATE TABLE public.imported_trackings (
	"id" text NOT NULL,
	"ticketId" text NOT NULL,
	"externalTrackingId" int4 NULL,
	"createdAtExternal" timestamp(3) NOT NULL,
	"startedAtExternal" timestamp(3) NULL,
	"endedAtExternal" timestamp(3) NULL,
	"lastRebuildMessageCreatedAt" timestamp(3) NULL,
	"processedAt" timestamp(3) NULL,
	"processingVersion" text NULL,
	"processingNotes" text NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT imported_trackings_pkey PRIMARY KEY ("id"),
	CONSTRAINT "imported_trackings_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public.tickets("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "imported_trackings_ticketId_idx" ON public.imported_trackings USING btree ("ticketId");

CREATE TABLE public.sessions (
	"id" text NOT NULL,
	"ticketId" text NOT NULL,
	"externalTrackingId" int4 NULL,
	"type" public."SessionType" NOT NULL,
	"startedAt" timestamp(3) NOT NULL,
	"endedAt" timestamp(3) NULL,
	"assignedUserName" text NULL,
	"assignedUserEmail" text NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"originImportedTrackingId" text NULL,
	"processingVersion" text NULL,
	"source" text NULL,
	"createdAtExternal" timestamp(3) NULL,
	CONSTRAINT sessions_pkey PRIMARY KEY ("id"),
	CONSTRAINT "sessions_originImportedTrackingId_fkey" FOREIGN KEY ("originImportedTrackingId") REFERENCES public.imported_trackings("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "sessions_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public.tickets("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sessions_ticketId_externalTrackingId_key" ON public.sessions USING btree ("ticketId", "externalTrackingId");
CREATE INDEX "sessions_ticketId_startedAt_idx" ON public.sessions USING btree ("ticketId", "startedAt");

CREATE TABLE public.messages (
	"id" text NOT NULL,
	"ticketId" text NOT NULL,
	"sessionId" text NULL,
	"externalMessageId" text NOT NULL,
	"key" text NULL,
	"body" text NOT NULL,
	"fromMe" bool NOT NULL,
	"mediaUrl" text NULL,
	"mediaType" text NULL,
	"createdAtExternal" timestamp(3) NOT NULL,
	"updatedAtExternal" timestamp(3) NOT NULL,
	"rawJson" jsonb NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"senderType" public."MessageSenderType" DEFAULT 'HUMAN'::"MessageSenderType" NOT NULL,
	CONSTRAINT messages_pkey PRIMARY KEY ("id"),
	CONSTRAINT "messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES public.sessions("id") ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT "messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public.tickets("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "messages_ticketId_createdAtExternal_idx" ON public.messages USING btree ("ticketId", "createdAtExternal");
CREATE UNIQUE INDEX "messages_ticketId_externalMessageId_key" ON public.messages USING btree ("ticketId", "externalMessageId");
CREATE INDEX "messages_ticketId_sessionId_createdAt_idx" ON public.messages USING btree ("ticketId", "sessionId", "createdAt");
CREATE INDEX "messages_ticketId_sessionId_fromMe_createdAt_idx" ON public.messages USING btree ("ticketId", "sessionId", "fromMe", "createdAt");

-- BANCO RAW --

CREATE TABLE public.ferracoCalls (
    "id" text NOT NULL,
    "xmlCdrUuid" text NOT NULL,
    "domainUuid" text NOT NULL,
    "extensionUuid" text NOT NULL,
    "direction" text NOT NULL,
    "callerIdNumber" text NOT NULL,
    "detinationNumber" text NOT NULL,
    "dateStart" timestamp(3) NOT NULL,
    "dataFinal" timestamp(3) NOT NULL,
    "duration" numeric NULL,
    "recordPath" text NULL,
    "recordName" text NULL,
    "hangupCause" text NULL,
    "sipHangupDisposition" text NULL,
    "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
    "sinapseClientId" text NOT NULL,
    CONSTRAINT ferracoCallsPkey PRIMARY KEY ("id"),
    CONSTRAINT "ferraco_calls_sinapse_client_id_fkey" FOREIGN KEY ("sinapseClientId") REFERENCES public.sinapseClients("id") ON DELETE SET NULL ON UPDATE CASCADE
)

CREATE TABLE public.ferracoBudgets (
	"id" SERIAL NOT NULL,
	"branch" varchar(100) NOT NULL,
	"sequential" int8  NULL,
	"davId" int8 NOT NULL,
	"sellerId" int4 NOT NULL,
	"sellerName" varchar(255) NOT NULL,
	"openingDate" date NOT NULL,
	"openingTime" time NOT NULL,
	"closingDate" date NULL,
	"closingTime" time NULL,
	"status" text NULL,
	"orderType" varchar(100) NULL,
	"customerName" varchar(255) NOT NULL,
	"cpfCnpj" varchar(18) NULL,
	"cellPhone" varchar(35) NULL,
	"phone" varchar NULL,
	"email" varchar(500) NULL,
	"value" numeric(19, 4) NOT NULL,
	"listOfSoldproducts" json NOT NULL,
	"sequentialLinkedSale" int8 NULL,
	"observation" varchar(500) NULL,
	CONSTRAINT ferracoBudgetsPkey PRIMARY KEY ("id")
    -- CONSTRAINT "budgetsBranchIdFkey" FOREIGN KEY ("branchId") REFERENCES public.branches("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE public.ferracoSales (
    "id" SERIAL NOT NULL,
    "branch" varchar(100) NULL,
    "sequential" int8 NULL,
    "invoiceSerie" int8 NOT NULL,
    "invoiceNumero" int8 NOT NULL,
    "model" text NOT NULL,
    "accessKey" text NOT NULL,
    "sellerId" int4 NOT NULL,
	"sellerName" varchar(255) NOT NULL,
    "date" date NOT NULL,
    "hour" time NOT NULL,
    "canceled" VARCHAR(10) NOT NULL,
    "customerName" varchar(255) NOT NULL,
	"cpfCnpj" varchar(18) NULL,
	"cellPhone" varchar(35) NULL,
	"phone" varchar NULL,
	"email" varchar(500) NULL,
	"value" numeric(19, 4) NOT NULL,
    "listOfSoldProducts" json NOT NULL,
    "listDavsId" text NULL,
    "observation" varchar(500) NULL,
    CONSTRAINT ferracoSalesPkey PRIMARY KEY ("id")
    -- CONSTRAINT "salesBranchIdFkey" FOREIGN KEY ("branchId") REFERENCES public.branches("id") ON DELETE RESTRICT ON UPDATE CASCADE
);