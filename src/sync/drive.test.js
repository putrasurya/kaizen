import { AuthError, DriveError, createSyncFile, findSyncFiles, updateSyncFile } from './drive';


const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

afterEach(() => vi.restoreAllMocks());

test('looks for the sync file only in the app folder, with the token', async () => {
  const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(
    respond(200, { files: [{ id: 'a', name: 'kaizen-sync-A.json' }, { id: 'x', name: 'something-else.json' }] })
  );
  expect(await findSyncFiles('tok')).toEqual([{ id: 'a', name: 'kaizen-sync-A.json' }]);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toContain('spaces=appDataFolder');
  expect(decodeURIComponent(url)).toContain("name contains 'kaizen-sync-'");
  expect(options.headers.Authorization).toBe('Bearer tok');
});

test('creates the file in the app folder as one multipart upload', async () => {
  const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(respond(200, { id: 'n', version: '1' }));
  await createSyncFile('tok', 'kaizen-sync-A.json', { hello: 1 });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toContain('uploadType=multipart');
  expect(options.method).toBe('POST');
  expect(options.body).toContain('"parents":["appDataFolder"]');
  expect(options.body).toContain('"name":"kaizen-sync-A.json"');
  expect(options.body).toContain('{"hello":1}');
});

test('updates replace the content', async () => {
  const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(respond(200, { id: 'a', version: '4' }));
  expect(await updateSyncFile('tok', 'a', { x: 1 })).toEqual({ id: 'a', version: '4' });
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PATCH', body: '{"x":1}' });
});

test('an expired token is an AuthError; being offline is a DriveError with status 0', async () => {
  vi.spyOn(window, 'fetch').mockResolvedValueOnce(respond(401, {}));
  await expect(findSyncFiles('old')).rejects.toBeInstanceOf(AuthError);

  vi.spyOn(window, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(findSyncFiles('tok')).rejects.toMatchObject({ status: 0 });

  vi.spyOn(window, 'fetch').mockResolvedValueOnce(respond(500, {}));
  await expect(findSyncFiles('tok')).rejects.toBeInstanceOf(DriveError);
});

test('an error shows Google\'s own reason', async () => {
  vi.spyOn(window, 'fetch').mockResolvedValueOnce(
    respond(403, { error: { code: 403, message: 'Google Drive API has not been used in project 838738185530 before or it is disabled.' } })
  );
  await expect(findSyncFiles('tok')).rejects.toThrow('Google Drive answered 403: Google Drive API has not been used in project 838738185530 before or it is disabled.');
});
