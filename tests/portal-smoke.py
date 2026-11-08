"""Run against an unconfigured local preview: python3 tests/portal-smoke.py"""
import urllib.request,urllib.error,json
base='http://127.0.0.1:5173'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None
op=urllib.request.build_opener(NoRedirect)
for path,location in [('/admin','/admin/login'),('/customer','/customer/login'),('/admin/project/123','/admin/login'),('/customer/project/123','/customer/login'),('/login','/customer/login'),('/projects','/customer'),('/demo','/demo/admin')]:
 try:op.open(base+path);raise AssertionError('Expected redirect '+path)
 except urllib.error.HTTPError as e:assert e.code==307 and e.headers['Location']==location,(path,e.code,e.headers)
 print(path,'redirect PASS')
for path,words in [('/customer/login',['RAMSON CUSTOMER PORTAL','Customer sign-in.','/demo/customer']),('/admin/login',['RAMSON ADMIN PORTAL','Team sign-in.','/demo/admin']),('/demo/customer',['SAMPLE CUSTOMER PORTAL','Purchase history','My contact']),('/demo/admin',['SAMPLE ADMIN PORTAL','Customer records','Enquiries']),('/contact',['Book a consultation','City / location','Project type'])]:
 html=op.open(base+path).read().decode()
 for w in words:assert w in html,(path,w)
 assert 'Book a free consultation' not in html
 if path=='/demo/customer':assert 'Services &amp; pricing' not in html and 'Customer records</button>' not in html
 print(path,'content PASS')
for path in ['/api/customers','/api/customer/00000000-0000-0000-0000-000000000000','/api/purchases','/api/profile']:
 try:op.open(base+path);raise AssertionError('Expected unauthorized')
 except urllib.error.HTTPError as e:assert e.code==401,(path,e.code)
 print(path,'unauthorized PASS')
for path in ['purchase','customer-update','profile']:
 req=urllib.request.Request(base+'/api/'+path,data=b'{}',headers={'Content-Type':'application/json','Origin':base},method='POST')
 try:op.open(req);raise AssertionError('Expected unavailable')
 except urllib.error.HTTPError as e:assert e.code==503,(path,e.code)
 print(path,'unconfigured write PASS')
