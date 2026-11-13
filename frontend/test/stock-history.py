"""Mocked browser checks for stock valuation, cost edits, and paginated history.
Start the frontend, then run this file with --base-url http://127.0.0.1:3100.
Requires Python Playwright and Chromium. No real database writes are performed.
"""
import importlib.util
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
spec=importlib.util.spec_from_file_location('checkout',str(Path(__file__).with_name('pos-checkout.py'))); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Stock(m.Shop):
 def route(self,r):
  path=m.urlparse(r.request.url).path
  if r.request.resource_type not in ('fetch','xhr') or r.request.url.startswith(self.base_url):return super().route(r)
  if path=='/inventory/history':
   from urllib.parse import parse_qs
   q=parse_qs(m.urlparse(r.request.url).query); page=int(q.get('page',['1'])[0]); direction=q.get('direction',['all'])[0]
   rows=[dict(id=i,inventoryItemId=7,userId=1,orderId=None,delta=1,stockAfter=i,reason='opening_balance',createdAt='2026-11-13T10:00:00Z',inventoryItem=self.items[0],user=m.USER) for i in range(30,0,-1)]
   if direction=='out':rows=[]
   return self.respond(r,dict(items=rows[(page-1)*25:page*25],total=len(rows),page=page,pageSize=25))
  if path in ['/recipes','/products/sold','/products/movements','/inventory/movements']:return self.respond(r,[])
  if path=='/inventory/archived':return self.respond(r,self.archived)
  if path=='/inventory/7/archive' and r.request.method=='POST':
   item=next(i for i in self.items if i['id']==7);self.items.remove(item);item['archivedAt']='2026-11-13T10:00:00Z';self.archived.append(item)
   return self.respond(r,item,status=201)
  if path=='/inventory/7/restore' and r.request.method=='POST':
   item=self.archived.pop();item['archivedAt']=None;self.items.append(item)
   return self.respond(r,item,status=201)
  if path=='/inventory':return self.respond(r,self.items)
  if path=='/inventory/7' and r.request.method=='PATCH':
   data=r.request.post_data_json
   assert 'stockQuantity' not in data, data
   assert data['costPerUnit']==3,data
   self.items[0].update(data);self.saved=True
   return self.respond(r,self.items[0])
  return super().route(r)
 def __init__(self,b,url):
  self.items=[dict(id=7,name='Milk',category='Raw Materials',unit='L',stockQuantity=10,minThreshold=12,costPerUnit=2.5),dict(id=8,name='Coffee',category='Raw Materials',unit='kg',stockQuantity=0,minThreshold=1,costPerUnit=10),dict(id=9,name='Cups',category='Packaging',unit='pcs',stockQuantity=5,minThreshold=2,costPerUnit=0)]
  self.archived=[]
  self.saved=False
  super().__init__(b,url)
parser=argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:3100')
parser.add_argument('--browser-path')
args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=args.browser_path)
 shop=Stock(b,args.base_url.rstrip('/'))
 try:
  page=shop.page;page.goto(shop.base_url+'/stock', timeout=180000);page.wait_for_load_state('networkidle');page.get_by_role('button',name='Supplies',exact=False).click()
  expect(page.get_by_text('Total stock items',exact=True)).to_be_visible()
  expect(page.get_by_text('$25.00',exact=True)).to_be_visible()
  expect(page.get_by_text('1 stocked items have no unit cost; stock value is incomplete.',exact=True)).to_be_visible()
  page.get_by_title('Edit Item',exact=True).first.click()
  page.get_by_label('Unit cost (USD per stock unit)').fill('3')
  page.get_by_role('button',name='Save Item',exact=True).click()
  expect(page.get_by_text('$30.00',exact=True)).to_be_visible()
  assert shop.saved
  expect(page.get_by_role('heading',name='Stock history',exact=True)).to_be_visible()
  page.get_by_role('button',name='Next page',exact=True).click()
  expect(page.get_by_role('button',name='Previous page',exact=True)).to_be_enabled()
  page.get_by_label('All movements',exact=True).select_option('out')
  expect(page.get_by_text('No stock movements match.',exact=True)).to_be_visible()
  expect(page.get_by_role('button',name='Previous page',exact=True)).to_be_disabled()
  page.get_by_role('button',name='Archive item',exact=True).first.click()
  expect(page.get_by_role('heading',name='Milk',exact=True)).to_have_count(0)
  page.get_by_role('button',name='Show archived items',exact=False).click()
  expect(page.get_by_role('heading',name='Milk',exact=True)).to_be_visible()
  expect(page.get_by_role('button',name='Stock in',exact=True)).to_have_count(0)
  page.get_by_role('button',name='Restore item',exact=True).click()
  page.get_by_role('button',name='Show active items',exact=False).click()
  expect(page.get_by_role('heading',name='Milk',exact=True)).to_be_visible()
  expect(page.get_by_text('$30.00',exact=True)).to_be_visible()
  print('PASS archive/restore, valuation, missing-cost warning, cost-only edits, history pagination and direction filters')
 finally:shop.close();b.close()
