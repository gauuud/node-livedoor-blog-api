// import { Node } from "@bouzuya/xml";
import request from "request";
import { promisify } from "util";
import wsse from "wsse";
import {
  Request,
  deleteMember,
  // getCollection,
  getMember,
  // getService,
  postCollection,
  putMember,
} from "./atom-pub";
import { BlogEntry, BlogEntryParams } from "./blog-type";
import { getEntry, toXml } from "./xml";

type Credentials = BasicAuthCredentials | WSSECredentials;

interface BasicAuthCredentials {
  apiKey: string;
  authType: "basic";
  livedoorId: string;
}

interface WSSECredentials {
  apiKey: string;
  authType: "wsse";
  livedoorId: string;
}

// TODO
// const getCategoryUri = (hatenaId: string, blogId: string): string => {
//   return `https://blog.hatena.ne.jp/${hatenaId}/${blogId}/atom/category`;
// };

const promisedRequest = promisify(request) as (
  p: request.UrlOptions & request.CoreOptions
) => Promise<request.Response>;

const authorizedRequest: (auth: Credentials) => Request = (
  credentials: Credentials
) => {
  return async ({ method, body, url }): Promise<{ body: string }> => {
    const response = await promisedRequest({
      ...(credentials.authType === "basic"
        ? {
            auth: {
              password: credentials.apiKey,
              username: credentials.livedoorId,
            },
          }
        : credentials.authType === "wsse"
        ? {
            headers: {
              Authorization: 'WSSE profile="UsernameToken"',
              "X-WSSE": wsse({
                password: credentials.apiKey,
                username: credentials.livedoorId,
              }).getWSSEHeader({ nonceBase64: true }),
            },
          }
        : {}),
      body,
      method,
      url,
    });
    return response;
  };
};

class Client {
  private _blogId: string;
  private _credentials: Credentials;
  // private _livedoorId: string;
  // private _collectionUri: string | null;

  constructor(params: Credentials & { blogId: string }) {
    this._credentials = params;
    this._blogId = params.blogId;
    // this._livedoorId = params.livedoorId;
    // this._collectionUri = null;
  }

  public async create(entryParams: BlogEntryParams): Promise<BlogEntry> {
    // const collectionUri = await this._ensureCollectionUri();
    const uri = `https://livedoor.blogcms.jp/atom/blog/${this._blogId}/article`;
    const requestXml = toXml(entryParams);

    const responseXml = await postCollection(
      authorizedRequest(this._credentials),
      uri,
      requestXml
    );
    return getEntry(responseXml.rootElement);
  }

  public async delete(memberUrl: BlogEntry["editUrl"]): Promise<void> {
    await deleteMember(authorizedRequest(this._credentials), memberUrl);
  }

  public async edit(
    memberUrl: BlogEntry["editUrl"],
    entryParams: BlogEntryParams
  ): Promise<BlogEntry> {
    const requestXml = toXml(entryParams);
    const responseXml = await putMember(
      authorizedRequest(this._credentials),
      memberUrl,
      requestXml
    );
    return getEntry(responseXml.rootElement);
  }

  public async retrieve(memberUrl: BlogEntry["editUrl"]): Promise<BlogEntry> {
    const responseXml = await getMember(
      authorizedRequest(this._credentials),
      memberUrl
    );
    return getEntry(responseXml.rootElement);
  }
}

export { Client };
