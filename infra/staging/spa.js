function handler(event) {
  var request = event.request;
  var last = request.uri.substring(request.uri.lastIndexOf('/') + 1);
  if (request.uri.endsWith('/') || last.indexOf('.') === -1) request.uri = '/index.html';
  return request;
}
