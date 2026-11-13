"""Browser regression checks for POS -> payment -> receipt, with a mocked API.

Requires: pip install playwright && playwright install chromium
Run a frontend dev server, then:
    python3 test/pos-checkout.py --base-url http://127.0.0.1:3100
No real orders, payments, or database writes are performed.
"""
import argparse
import copy
import json
import re
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

NOW = '2026-11-13T10:00:00.000Z'
USER = dict(id=1, name='Checkout Tester', username='checkout-test', role='admin', avatar=None, allowedPages=None)
PRODUCT = dict(id=1, name='Test Cake', categoryId=1, category=dict(id=1, name='Pastry'), price=1,
               discountPercent=0, stockMode='count', stock=8, isAvailable=True,
               description=None, image=None, gallery=None, archivedAt=None, variants=[], recipes=[], createdAt=NOW, updatedAt=NOW)

class Shop:
    def __init__(self, browser, base_url, *, cashier=False, payments=True, recipe=False, lost_payment=False, decline=False, order_error=False):
        self.context = browser.new_context(viewport=dict(width=1440, height=1000), locale='en-US')
        self.user = copy.deepcopy(USER)
        if cashier:
            self.user.update(role='cashier', allowedPages=['pos'] + (['payments'] if payments else []))
        self.base_url = base_url
        self.origin = 'cashier-pos' if cashier else 'pos'
        self.pos_path = '/cashier/pos' if cashier else '/pos'
        self.product = copy.deepcopy(PRODUCT)
        self.recipe = recipe
        if recipe:
            self.product.update(stockMode='recipe', stock=0, recipes=[dict(size=None, servings=8, options=[dict(inventoryItemId=9, name='Sugar', quantity=2, unit='g')])])
        self.order = None
        self.payment = None
        self.order_posts = []
        self.payment_posts = []
        self.lost_payment = lost_payment
        self.decline = decline
        self.order_error = order_error
        self.pending_order_route = None
        self.pending_payment_route = None
        self.hold_order = False
        self.hold_payment = False
        self.context.add_init_script('localStorage.setItem("poscafe_token", "browser-test-token"); localStorage.setItem("poscafe_user", '+json.dumps(json.dumps(self.user))+');')
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.set_default_timeout(30000)
        self.page.goto(base_url+self.pos_path, timeout=180000)
        self.page.wait_for_load_state('networkidle')
        expect(self.page.get_by_role('button', name='Add', exact=True)).to_be_visible()

    def respond(self, route, data=None, status=200):
        headers = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS'}
        if status == 204:
            route.fulfill(status=status, headers=headers)
        else:
            route.fulfill(status=status, content_type='application/json', body=json.dumps(data), headers=headers)

    def route(self, route):
        req = route.request
        url = urlparse(req.url)
        if req.url.startswith(self.base_url) or req.resource_type not in ('fetch', 'xhr'):
            route.continue_()
            return
        path = url.path
        if req.method == 'OPTIONS':
            self.respond(route, status=204)
        elif path == '/auth/me':
            self.respond(route, self.user)
        elif path == '/settings':
            self.respond(route, dict(appName='Test Cafe', logoUrl=None, khrPerUsd=4100, khqrEnabled=False))
        elif path == '/categories':
            self.respond(route, [dict(id=1, name='Pastry', isActive=True)])
        elif path == '/products':
            self.respond(route, [self.product])
        elif path == '/inventory':
            self.respond(route, [dict(id=9, name='Sugar', category='Raw Materials', unit='g', stockQuantity=100, minThreshold=0, costPerUnit=0)] if self.recipe else [])
        elif path == '/orders' and req.method == 'POST':
            payload = req.post_data_json
            if self.order_error:
                self.respond(route, dict(message='Insufficient stock'), status=400)
                return
            self.order_posts.append(payload)
            assert len(self.order_posts) == 1, 'Checkout created duplicate orders'
            self.order = dict(id=101, orderNumber='ORD-000101', userId=1, status='pending', paymentStatus='unpaid', total=1, createdAt=NOW, updatedAt=NOW,
                              items=[dict(id=1, orderId=101, productId=1, product=self.product, quantity=1, size=None, unitPrice=1, subtotal=1, note=payload['items'][0].get('note'), extras=None, stockSource='stock')])
            if self.hold_order:
                self.pending_order_route = route
            else:
                self.respond(route, self.order, status=201)
        elif path == '/orders/101':
            self.respond(route, self.order)
        elif path == '/orders':
            self.respond(route, [self.order] if self.order else [])
        elif path == '/payments/order/101':
            self.respond(route, self.payment, status=200 if self.payment else 204)
        elif path == '/payments' and req.method == 'POST':
            data = req.post_data_json
            self.payment_posts.append(data)
            assert data['orderId'] == 101
            if self.decline:
                self.respond(route, dict(message='Payment could not be confirmed'), status=400)
                return
            tendered = data.get('tendered', 1)
            self.payment = dict(id=5, orderId=101, method=data['method'], amount=1, tendered=tendered, change=round(tendered-1, 2), refundedAt=None, refundedById=None, createdAt=NOW, updatedAt=NOW)
            self.order.update(status='completed', paymentStatus='paid')
            if self.hold_payment:
                self.pending_payment_route = route
            elif self.lost_payment:
                self.lost_payment = False
                route.abort('failed')
            else:
                self.respond(route, self.payment, status=201)
        else:
            self.respond(route, dict(message='Unexpected test API: '+path), status=404)

    def add(self):
        self.page.get_by_role('button', name='Add', exact=True).click()

    def pay(self, *, addons=False):
        self.add()
        self.page.get_by_role('button', name=re.compile(r'^Pay \$1\.00')).click()
        if addons:
            expect(self.page.get_by_role('dialog')).to_be_visible()
            assert not self.order_posts
            self.page.get_by_role('spinbutton', name='Sugar per cup (g)').fill('3')
            self.page.get_by_role('button', name='Continue to payment', exact=True).click()
        expect(self.page).to_have_url(re.compile(r'/pay\?orderId=101&from='+self.origin))
        expect(self.page.get_by_role('button', name='Cash', exact=True)).to_be_visible()
        expect(self.page.get_by_role('button', name='QR', exact=True)).to_be_visible()
        expect(self.page.get_by_role('button', name='Card', exact=True)).to_be_visible()

    def receipt(self):
        expect(self.page).to_have_url(re.compile(r'/receipt\?orderId=101&from='+self.origin))
        expect(self.page.get_by_role('status')).to_contain_text('Payment complete')
        expect(self.page.get_by_role('button', name='Print', exact=False)).to_be_visible()
        expect(self.page.get_by_role('link', name='Back to POS', exact=False)).to_have_attribute('href', self.pos_path)
        assert len(self.order_posts) == 1
        assert len(self.payment_posts) == 1

    def close(self):
        self.context.close()


def run(browser, base_url):
    shop = Shop(browser, base_url)
    try:
        shop.pay()
        expect(shop.page.get_by_role('button', name='Confirm cash payment', exact=False)).to_be_disabled()
        shop.page.get_by_role('button', name='$5', exact=True).click()
        expect(shop.page.get_by_text('Change $4.00', exact=False)).to_be_visible()
        shop.page.screenshot(path='/tmp/pos-checkout-payment.png', full_page=True)
        shop.page.get_by_role('button', name='Confirm cash payment', exact=False).click()
        shop.receipt()
        shop.page.screenshot(path='/tmp/pos-checkout-receipt.png', full_page=True)
        print('PASS cash payment, change, receipt and POS return')
    finally:
        shop.close()

    for method in ['QR', 'Card']:
        shop = Shop(browser, base_url)
        try:
            shop.pay()
            shop.page.get_by_role('button', name=method, exact=True).click()
            shop.page.get_by_role('button', name='Confirm '+method.lower()+' payment', exact=False).click()
            shop.receipt()
            assert shop.payment_posts[0]['method'] == method.lower()
            assert 'tendered' not in shop.payment_posts[0]
            print('PASS '+method+' payment and receipt')
        finally:
            shop.close()

    shop = Shop(browser, base_url, lost_payment=True)
    try:
        shop.pay()
        shop.page.get_by_role('button', name='Exact', exact=True).click()
        shop.page.get_by_role('button', name='Confirm cash payment', exact=False).click()
        shop.receipt()
        print('PASS lost payment response recovery without duplicate payment')
    finally:
        shop.close()

    shop = Shop(browser, base_url, decline=True)
    try:
        shop.pay()
        shop.page.get_by_role('button', name='Exact', exact=True).click()
        shop.page.get_by_role('button', name='Confirm cash payment', exact=False).click()
        expect(shop.page.get_by_text('Payment could not be confirmed', exact=True)).to_be_visible()
        assert '/pay?' in shop.page.url and len(shop.order_posts) == 1
        shop.decline = False
        shop.payment_posts.clear()
        shop.page.get_by_role('button', name='Confirm cash payment', exact=False).click()
        shop.receipt()
        print('PASS payment failure stays on same order and can retry')
    finally:
        shop.close()

    shop = Shop(browser, base_url)
    try:
        shop.add()
        shop.page.get_by_role('button', name='Place Order / Pay Later', exact=True).click()
        expect(shop.page.get_by_text('Order ORD-000101 placed', exact=False)).to_be_visible()
        assert shop.page.url.endswith('/pos') and not shop.payment_posts and len(shop.order_posts) == 1
        shop.page.get_by_role('link', name='Pay', exact=True).click()
        expect(shop.page.get_by_role('button', name='Cash', exact=True)).to_be_visible()
        assert len(shop.order_posts) == 1
        print('PASS pay later and resuming payment without another order')
    finally:
        shop.close()

    shop = Shop(browser, base_url, cashier=True, payments=False)
    try:
        shop.add()
        expect(shop.page.get_by_role('button', name=re.compile(r'^Pay \$1\.00'))).to_have_count(0)
        shop.page.get_by_role('button', name=re.compile(r'^Place order')).click()
        expect(shop.page.get_by_text('Order ORD-000101 placed', exact=False)).to_be_visible()
        expect(shop.page.get_by_role('link', name='Pay', exact=True)).to_have_count(0)
        assert not shop.payment_posts
        print('PASS cashier without payment permission retains order-only checkout')
    finally:
        shop.close()

    shop = Shop(browser, base_url, cashier=True)
    try:
        shop.pay()
        shop.page.get_by_role('button', name='Exact', exact=True).click()
        shop.page.get_by_role('button', name='Confirm cash payment', exact=False).click()
        shop.receipt()
        print('PASS cashier namespace preserved through payment and receipt')
    finally:
        shop.close()

    shop = Shop(browser, base_url, recipe=True)
    try:
        shop.pay(addons=True)
        assert shop.order_posts[0]['items'][0]['extras'] == [dict(inventoryItemId=9, quantity=3)]
        print('PASS add-ons preserved before continuing to payment')
    finally:
        shop.close()

    shop = Shop(browser, base_url, order_error=True)
    try:
        shop.add()
        shop.page.get_by_role('button', name=re.compile(r'^Pay \$1\.00')).click()
        expect(shop.page.get_by_text('Insufficient stock', exact=True)).to_be_visible()
        expect(shop.page.get_by_role('button', name=re.compile(r'^Pay \$1\.00'))).to_be_enabled()
        assert shop.page.url.endswith('/pos') and not shop.order_posts and not shop.payment_posts
        print('PASS order failure preserves cart')
    finally:
        shop.close()

    shop = Shop(browser, base_url)
    try:
        shop.pay()
        shop.page.get_by_role('button', name='Exact', exact=True).click()
        shop.hold_payment = True
        shop.page.get_by_role('button', name='Confirm cash payment', exact=False).click()
        expect(shop.page.get_by_role('button', name='Processing...', exact=True)).to_be_visible()
        shop.page.get_by_role('link', name='Back to POS', exact=False).click()
        expect(shop.page.get_by_role('button', name='Add', exact=True)).to_be_visible()
        shop.add()
        assert shop.pending_payment_route is not None
        shop.respond(shop.pending_payment_route, shop.payment, status=201)
        shop.page.wait_for_load_state('networkidle')
        expect(shop.page.get_by_role('button', name=re.compile(r'^Pay \$1\.00'))).to_be_visible()
        assert shop.page.url.endswith('/pos')
        print('PASS late payment response does not override navigation or discard a new cart')
    finally:
        shop.close()

    shop = Shop(browser, base_url)
    try:
        shop.add()
        shop.hold_order = True
        shop.page.get_by_role('button', name=re.compile(r'^Pay \$1\.00')).click()
        expect(shop.page.get_by_role('button', name='Placing order…', exact=True)).to_be_visible()
        shop.page.get_by_role('link', name='Payments', exact=True).click()
        expect(shop.page.get_by_role('heading', name='Take Payment', exact=True)).to_be_visible()
        assert shop.pending_order_route is not None
        shop.respond(shop.pending_order_route, shop.order, status=201)
        shop.page.wait_for_load_state('networkidle')
        expect(shop.page.get_by_role('heading', name='Take Payment', exact=True)).to_be_visible()
        assert '/pay?' not in shop.page.url
        print('PASS late order response does not override later navigation')
    finally:
        shop.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:3100')
    parser.add_argument('--browser-path', help='Optional existing Chromium executable')
    args = parser.parse_args()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=args.browser_path)
        try:
            run(browser, args.base_url.rstrip('/'))
        finally:
            browser.close()
